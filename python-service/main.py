"""
FastAPI server for AI Market Pulse ML Service
Serves predictions from trained models
"""

from datetime import datetime, timedelta
import logging
import glob
import json
import os
import re
import sys
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator, Field
import gc
import io
import pickle
import joblib
import re
import pandas as pd
import numpy as np
import nltk

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ensure NLTK data is available (download if not present)
def ensure_nltk_data():
    """Download required NLTK data if not present"""
    nltk_data_dir = os.environ.get('NLTK_DATA', None)
    required_resources = ['stopwords', 'punkt', 'wordnet']
    
    for resource in required_resources:
        try:
            if resource == 'stopwords':
                nltk.data.find(f'corpora/{resource}')
            elif resource == 'punkt':
                nltk.data.find(f'tokenizers/{resource}')
            elif resource == 'wordnet':
                nltk.data.find(f'corpora/{resource}')
        except LookupError:
            logger.info(f"Downloading NLTK resource: {resource}")
            try:
                if nltk_data_dir:
                    nltk.download(resource, download_dir=nltk_data_dir, quiet=True)
                else:
                    nltk.download(resource, quiet=True)
            except Exception as e:
                logger.warning(f"Failed to download {resource}: {e}")

# Download NLTK data at module load
ensure_nltk_data()

from nltk.stem import PorterStemmer
from nltk.corpus import stopwords

# Constants for validation
MAX_SALES_DATA_POINTS = 50000  # Support up to 50k rows for 1+ year data
MAX_FORECAST_DAYS = 30
MAX_PRODUCT_ID_LENGTH = 100
CHUNK_SIZE = 10000  # Process in chunks for memory efficiency

# Ensure local imports resolve when running as a script
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from models.xgboost_optimal import forecaster, HybridBrain  # noqa: E402
from models.ensemble import EnsemblePredictor  # noqa: E402
from models.inventory_optimizer import InventoryOptimizer  # noqa: E402
from models.profit_analyzer import ProfitAnalyzer  # noqa: E402
from models.weekly_report_ranker import WeeklyReportRanker, RankingStrategy  # noqa: E402
from utils.cache import model_cache  # noqa: E402

app = FastAPI(
    title="AI Market Pulse ML Service",
    description="ML predictions for sales forecasting",
    version="1.1.0"
)

# CORS - SECURITY FIX: Configure allowed origins from environment
def get_allowed_origins() -> List[str]:
    """Get allowed CORS origins from environment or use defaults"""
    env_origins = os.getenv("ALLOWED_ORIGINS", "")
    if env_origins:
        return [origin.strip() for origin in env_origins.split(",")]

    # Default allowed origins
    if os.getenv("ENV", "development") == "production":
        # In production, only allow specific origins
        return [
            os.getenv("FRONTEND_URL", "https://megaw-ai.vercel.app"),
            os.getenv("BACKEND_URL", "https://api.megaw-ai.com"),
        ]

    # In development, allow localhost
    return [
        "http://localhost:3000",
        "http://localhost:5000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5000",
    ]

allowed_origins = get_allowed_origins()
logger.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Internal-API-Key"],
)

# Initialize components
ensemble = EnsemblePredictor()
report_ranker = WeeklyReportRanker(default_strategy="balanced")

# --- Sentiment helpers ---
# NLTK resources already ensured at module load via ensure_nltk_data()
STOPWORDS = set(stopwords.words('english'))
STEMMER = PorterStemmer()

SENTIMENT_MODEL_PATH = os.path.join(BASE_DIR, "models", "xgboost_sentiment.pkl")
TFIDF_PATH = os.path.join(BASE_DIR, "models", "tfidf_vectorizer.pkl")

# Simple Indonesian-to-English word map (lightweight, no external API)
# Extended dictionary for better review sentiment detection
ID_TO_EN_MAP = {
    # ============= POSITIF UMUM =============
    "bagus": "good",
    "baik": "good",
    "terbaik": "excellent",
    "luar biasa": "amazing",
    "mantap": "great",
    "suka": "love",
    "cinta": "love",
    "cocok": "suitable",
    "puas": "satisfied",
    "senang": "happy",
    "bahagia": "happy",
    "ramah": "friendly",
    "helpful": "helpful",
    "membantu": "helpful",
    "nyaman": "comfortable",
    "recommended": "recommended",
    "rekomendasi": "recommended",
    "enak": "delicious",
    "lezat": "delicious",
    "gurih": "savory",
    "nikmat": "delicious",
    "segar": "fresh",
    "murah": "cheap",
    "terjangkau": "affordable",
    "worthed": "worth it",
    "worth": "worth it",
    "bersih": "clean",
    "rapi": "tidy",
    "rapih": "tidy",
    "cepat": "fast",
    "responsif": "responsive",
    "keren": "cool",
    "hebat": "great",
    "menarik": "interesting",
    "favorite": "favorite",
    "rekomen": "recommended",
    "rekomend": "recommended",
    "recomended": "recommended",
    "recomend": "recommended",
    "direkomendasikan": "recommended",
    "disarankan": "recommended",
    "sarankan": "recommend",
    "uenak": "delicious",
    "enakk": "delicious",
    "enakkk": "delicious",
    "mantepp": "great",
    "mantapp": "great",
    "mantul": "great",
    "mantab": "great",
    "memuaskan": "satisfying",
    "puass": "satisfied",
    "sukak": "love",
    "sukaa": "love",
    "sukakk": "love",
    "kerenn": "cool",
    "kerennn": "cool",
    "mewah": "luxurious",
    "cantik": "beautiful",
    "indah": "beautiful",
    "baguss": "good",
    "bagusss": "good",
    "terbagus": "best",
    "paling": "most",
    "termurah": "cheapest",
    "terenak": "most delicious",
    "ternyaman": "most comfortable",
    "terlezat": "most delicious",
    "bagusan": "better",
    "mendingan": "better",
    "mending": "better",
    "lebih bagus": "better",
    "lebih enak": "tastier",
    
    # ============= NEGATIF UMUM =============
    "buruk": "bad",
    "jelek": "bad",
    "parah": "awful",
    "terburuk": "worst",
    "mengecewakan": "disappointing",
    "kecewa": "disappointed",
    "benci": "hate",
    "payah": "terrible",
    "sampah": "trash",
    "kacau": "messy",
    "amburadul": "messy",
    "lambat": "slow",
    "lemot": "slow",
    "mahal": "expensive",
    "overprice": "overpriced",
    "overpriced": "overpriced",
    "kotor": "dirty",
    "jorok": "dirty",
    "bau": "smelly",
    "palsu": "fake",
    "bohong": "lie",
    "tipu": "scam",
    "tipuan": "scam",
    "kurang": "less",
    "tidak": "not",
    "nggak": "not",
    "enggak": "not",
    "engga": "not",
    "tak": "not",
    "sulit": "difficult",
    "ribet": "complicated",
    "berisik": "noisy",
    "ramai": "crowded",
    "macet": "traffic jam",
    "rusak": "broken",
    "cacat": "defect",
    "lelet": "slow",
    "pelit": "stingy",
    "jahat": "mean",
    "biasa": "ordinary",
    "standar": "standard",
    "jelekk": "bad",
    "jelekkkk": "bad",
    "burukk": "bad",
    "parahh": "awful",
    "kotorr": "dirty",
    "mahall": "expensive",
    "termahal": "most expensive",
    "kemahalan": "too expensive",
    "kemurahan": "too cheap",
    "terjelek": "worst",
    "terparah": "worst",
    "terburukk": "worst",
    "busuk": "rotten",
    "basi": "stale",
    "bosen": "bored",
    "bosann": "bored",
    "bosan": "bored",
    "membosankan": "boring",
    "boring": "boring",
    "kesal": "annoyed",
    "marah": "angry",
    "jengkel": "irritated",
    "kesel": "annoyed",
    "sebel": "annoyed",
    "sebal": "annoyed",
    "sedih": "sad",
    "suram": "gloomy",
    "menyedihkan": "sad",
    "menjijikkan": "disgusting",
    "jijik": "disgusted",
    "ilfeel": "turned off",
    "ilfil": "turned off",
    "mengerikan": "terrible",
    "hancur": "ruined",
    "ancur": "ruined",
    "berantakan": "messy",
    "gk": "not",
    "g": "not",
    "tdk": "not",
    "ndak": "not",
    "ora": "not",
    "gada": "no",
    
    # ============= NETRAL =============
    "biasa saja": "average",
    "so so": "average",
    "so-so": "average",
    "lumayan": "quite okay",
    "cukupan": "adequate",
    "standarnya": "standard",
    "ya gitu": "so-so",
    "gitu aja": "just okay",
    "gitu deh": "just okay",
    "begitulah": "just okay",
    "yaudah": "okay then",
    "yauda": "okay then",
    
    # ============= PELAYANAN / PENGALAMAN =============
    "pelayanan": "service",
    "service": "service",
    "admin": "admin",
    "respon": "response",
    "balas": "reply",
    "antri": "queue",
    "antrian": "queue",
    "proses": "process",
    "pengiriman": "delivery",
    "kirim": "ship",
    "packing": "packaging",
    "paket": "package",
    "refund": "refund",
    "retur": "return",
    "tukar": "exchange",
    "delay": "delay",
    "telat": "late",
    "terlambat": "late",
    "pelayananan": "service",
    "pelayananya": "the service",
    "pelayanannya": "the service",
    "servisnya": "the service",
    "responnya": "the response",
    "balasannya": "the reply",
    "pengirimannya": "the delivery",
    "packingnya": "the packaging",
    "ontime": "on time",
    "tepat": "on time",
    
    # ============= KUALITAS PRODUK =============
    "ori": "original",
    "original": "original",
    "asli": "original",
    "kw": "fake",
    "kw1": "fake",
    "kw2": "fake",
    "kualitas": "quality",
    "awet": "durable",
    "kuat": "strong",
    "ringkih": "fragile",
    "tipis": "thin",
    "tebal": "thick",
    "lusuh": "worn",
    "baret": "scratched",
    "gores": "scratched",
    "goresan": "scratches",
    "kualitasnya": "the quality",
    "produknya": "the product",
    "barangnya": "the item",
    "produk": "product",
    "barang": "item",
    "berkualitas": "high quality",
    "murahan": "cheap quality",
    
    # ============= RASA / MAKANAN =============
    "asin": "salty",
    "manis": "sweet",
    "asam": "sour",
    "pahit": "bitter",
    "pedas": "spicy",
    "hambar": "bland",
    "tawar": "bland",
    "rasanya": "the taste",
    "rasa": "taste",
    "bumbu": "seasoning",
    "bumbunya": "the seasoning",
    "kuah": "broth",
    "kuahnya": "the broth",
    "dagingnya": "the meat",
    "daging": "meat",
    "sayurnya": "the vegetables",
    "nasinya": "the rice",
    "nasi": "rice",
    "porsinya": "the portion",
    "wadah": "container",
    "penyajian": "presentation",
    "makanannya": "the food",
    "minumannya": "the drink",
    "kopinya": "the coffee",
    "tehnya": "the tea",
    "mantep": "great",
    "garing": "crispy",
    "renyah": "crispy",
    "empuk": "tender",
    "keras": "hard",
    "alot": "chewy",
    "lembut": "soft",
    "tekstur": "texture",
    "teksturnya": "the texture",
    "aroma": "aroma",
    "aromanya": "the aroma",
    "wangi": "fragrant",
    "harum": "fragrant",
    
    # ============= KEBERSIHAN / KENYAMANAN =============
    "kebersihan": "cleanliness",
    "kebersihannya": "cleanliness",
    "higienis": "hygienic",
    "sumpek": "stuffy",
    "pengap": "stuffy",
    "dingin": "cold",
    "panas": "hot",
    "sejuk": "cool",
    "adem": "cool",
    "hangat": "warm",
    "acnya": "the AC",
    "ac": "AC",
    "kipas": "fan",
    
    # ============= KERAMAIAN / SUASANA =============
    "sepi": "quiet",
    "tenang": "calm",
    "penuh": "full",
    "suasana": "atmosphere",
    "suasananya": "the atmosphere",
    "atmosfer": "atmosphere",
    "vibes": "vibes",
    "vibe": "vibe",
    "aesthetic": "aesthetic",
    "estetik": "aesthetic",
    "instagramable": "instagrammable",
    "fotogenik": "photogenic",
    "cozy": "cozy",
    "homey": "homey",
    
    # ============= HARGA / NILAI =============
    "diskon": "discount",
    "promo": "promo",
    "harga": "price",
    "harganya": "the price",
    "biaya": "cost",
    "ongkir": "shipping cost",
    "ongkos": "cost",
    "gratis": "free",
    "gratiss": "free",
    "free": "free",
    "bayar": "pay",
    "mahalnya": "expensive",
    "murahnya": "cheap",
    "worthit": "worth it",
    "sebanding": "comparable",
    "sepadan": "worth it",
    "setimpal": "worth it",
    
    # ============= LOKASI / KONTEKS UMUM =============
    "makanan": "food",
    "minuman": "drink",
    "tempat": "place",
    "lokasi": "location",
    "disini": "here",
    "sini": "here",
    "sana": "there",
    "resto": "restaurant",
    "restoran": "restaurant",
    "warung": "eatery",
    "kedai": "shop",
    "toko": "shop",
    "cafe": "cafe",
    "kafe": "cafe",
    "ini": "this",
    "itu": "that",
    "tempatnya": "the place",
    "lokasinya": "the location",
    "alamat": "address",
    "alamatnya": "the address",
    "parkir": "parking",
    "parkirnya": "the parking",
    "akses": "access",
    "aksesnya": "the access",
    "strategis": "strategic",
    
    # ============= PRONOMINA / KATA BANTU =============
    "saya": "i",
    "aku": "i",
    "gue": "i",
    "gw": "i",
    "gua": "i",
    "kami": "we",
    "kita": "we",
    "menurut": "according",
    "menurutku": "in my opinion",
    "menurutnya": "in their opinion",
    "sy": "i",
    "q": "i",
    "w": "i",
    "lu": "you",
    "lo": "you",
    "kamu": "you",
    "kalian": "you all",
    "dia": "they",
    "mereka": "they",
    
    # ============= INTENSIFIER / PENGUAT =============
    "sangat": "very",
    "banget": "really",
    "sekali": "very",
    "amat": "very",
    "bgt": "really",
    "bngt": "really",
    "bngtt": "really",
    "bangett": "really",
    "bangettt": "really",
    "poll": "really",
    "pol": "really",
    "parah": "extremely",
    "super": "super",
    "agak": "somewhat",
    "sedikit": "a bit",
    "terlalu": "too",
    "kelewatan": "too much",
    "kebangetan": "too much",
    "kebangeten": "too much",
    "ekstrem": "extreme",
    "extreme": "extreme",
    
    # ============= SLANG POSITIF =============
    "jos": "great",
    "top": "top",
    "oke": "okay",
    "ok": "okay",
    "okelah": "okay",
    "gokil": "amazing",
    "kece": "cool",
    "asik": "fun",
    "asyik": "fun",
    "sip": "good",
    "sippp": "good",
    "waw": "wow",
    "wow": "wow",
    "juara": "champion",
    "juaranya": "the best",
    "perfect": "perfect",
    "sempurna": "perfect",
    "best": "best",
    "favorit": "favorite",
    "andalan": "favorite",
    "langganan": "regular",
    "pasti": "definitely",
    "wajib": "must",
    "harus": "must",
    "coba": "try",
    "cobain": "try",
    "rekomendasiin": "recommend",
    "rekomenin": "recommend",
    "cuss": "go",
    "gas": "go",
    "gasss": "go",
    "gaslah": "go",
    "ayok": "let's go",
    "ayo": "let's go",
    "yuk": "let's go",
    "yukk": "let's go",
    "yuks": "let's go",
    "nais": "nice",
    "nice": "nice",
    "mantaps": "great",
    "josss": "great",
    "joss": "great",
    "cakep": "nice",
    "kuy": "let's go",
    "cuangg": "money",
    "cuan": "money",
    "sultan": "rich",
    "mevvah": "luxurious",
    "mevah": "luxurious",
    "premium": "premium",
    "legit": "legit",
    "legitt": "legit",
    "auto": "automatically",
    "otomatis": "automatically",
    "langsung": "immediately",
    "instan": "instant",
    "sat set": "quick",
    "satset": "quick",
    
    # ============= SLANG NEGATIF =============
    "zonk": "bad",
    "gagal": "failed",
    "fail": "failed",
    "ngga": "not",
    "ga": "not",
    "gak": "not",
    "kagak": "not",
    "ogah": "refuse",
    "males": "lazy",
    "malas": "lazy",
    "kapok": "regret",
    "nyesel": "regret",
    "menyesal": "regret",
    "rugi": "loss",
    "buang": "waste",
    "mubazir": "waste",
    "percuma": "useless",
    "penipuan": "scam",
    "penipu": "scammer",
    "aneh": "weird",
    "gila": "crazy",
    "ngeri": "scary",
    "serem": "scary",
    "horror": "horrible",
    "horor": "horrible",
    "scam": "scam",
    "abal": "fake",
    "abal2": "fake",
    "abal-abal": "fake",
    "fiktif": "fake",
    "palsukan": "fake",
    "bohongan": "fake",
    "tipu2": "scam",
    "tipu-tipu": "scam",
    "php": "false hope",
    "hopeless": "hopeless",
    "malesin": "annoying",
    "nyebelin": "annoying",
    "bete": "annoyed",
    "bt": "annoyed",
    "ngeselin": "annoying",
    "ketipu": "got scammed",
    "tertipu": "got scammed",
    "dikerjain": "got tricked",
    "ditipu": "got scammed",
    "gblk": "stupid",
    "tolol": "stupid",
    "bego": "stupid",
    "dodol": "stupid",
    "geblek": "stupid",
    "goblok": "stupid",
    "parah sih": "really bad",
    "ampas": "trash",
    "sampahh": "trash",
    "burik": "ugly",
    "jeblok": "failed",
    "flop": "flop",
    
    # ============= WAKTU / FREKUENSI =============
    "selalu": "always",
    "sering": "often",
    "kadang": "sometimes",
    "jarang": "rarely",
    "pernah": "ever",
    "belum": "not yet",
    "sudah": "already",
    "udah": "already",
    "dah": "already",
    "lagi": "again",
    "baru": "new",
    "pertama": "first",
    "kedua": "second",
    "pertamakali": "first time",
    "pertamakalinya": "first time",
    "sebelumnya": "before",
    "kemarin": "yesterday",
    "tadi": "earlier",
    "nanti": "later",
    "besok": "tomorrow",
    "hari ini": "today",
    
    # ============= UKURAN / PORSI =============
    "banyak": "many",
    "dikit": "few",
    "cukup": "enough",
    "lebih": "more",
    "porsi": "portion",
    "besar": "big",
    "kecil": "small",
    "gede": "big",
    "jumbo": "jumbo",
    "mini": "mini",
    "regular": "regular",
    "medium": "medium",
    "large": "large",
    "xl": "extra large",
    "xxl": "extra extra large",
    "melimpah": "abundant",
    "berlimpah": "abundant",
    "sedikit": "a little",
    "sedikitt": "a little",
    
    # ============= EKSPRESI REVIEW UMUM =============
    "overall": "overall",
    "keseluruhan": "overall",
    "kesimpulan": "conclusion",
    "intinya": "in short",
    "singkatnya": "in short",
    "pokoknya": "basically",
    "pokonya": "basically",
    "soalnya": "because",
    "karena": "because",
    "karna": "because",
    "krn": "because",
    "krna": "because",
    "untungnya": "fortunately",
    "sayangnya": "unfortunately",
    "padahal": "even though",
    "seharusnya": "should be",
    "harusnya": "should be",
    "mustinya": "should be",
    "mestinya": "should be",
    
    # ============= APPROVAL / DISAPPROVAL =============
    "setuju": "agree",
    "agree": "agree",
    "approved": "approved",
    "acc": "approved",
    "deal": "deal",
    "fix": "definitely",
    "fixx": "definitely",
    "pasti": "definitely",
    "pastii": "definitely",
    "tentu": "certainly",
    "yakin": "sure",
    "ragu": "doubtful",
    "bimbang": "hesitant",
}

# Extended set of Indonesian hint words for language detection
ID_HINT_WORDS = {
    # Kata penghubung / partikel
    "yang", "dan", "di", "ke", "dari", "tidak", "tidaknya", "dengan", "untuk", "pada",
    "adalah", "itu", "ini", "juga", "akan", "bisa", "biar", "agar", "supaya", "nih",
    "dong", "deh", "sih", "lah", "lho", "kan", "ya", "yah", "yaa", "kah", "pun",
    # Pronomina
    "kita", "kami", "saya", "aku", "gue", "gw", "gua", "kamu", "dia", "mereka", "kalian",
    "sy", "lu", "lo", "elo", "gw", "gue", "dia", "mrk",
    # Kata tanya
    "apa", "siapa", "kapan", "dimana", "mengapa", "kenapa", "bagaimana", "gimana",
    "gmn", "gmana", "knp", "knapa",
    # Kata sifat umum
    "ada", "jadi", "karena", "karna", "krn", "atau", "tapi", "tetapi", "namun", "walau", "meski",
    # Konteks review - POSITIF
    "disini", "kesini", "makanan", "minuman", "tempat", "pelayanan", "harga", 
    "murah", "suka", "rekomendasi", "recommended", "rekomen", "rekomendasiin",
    "enak", "enakk", "bagus", "baguss", "mantap", "mantapp", "keren", "kerenn",
    "puas", "puass", "memuaskan", "recommended", "worthit", "worth", "terbaik",
    "nyaman", "ramah", "cepat", "responsif", "bersih", "segar", "lezat", "nikmat",
    "perfect", "sempurna", "favorit", "andalan", "langganan", "jos", "joss",
    "gokil", "kece", "mantul", "top", "best", "oke", "ok", "sip", "asik", "asyik",
    # Konteks review - NEGATIF  
    "mahal", "benci", "jelek", "jelekk", "buruk", "parah", "kotorr", "kotor",
    "jorok", "lambat", "lemot", "lelet", "kecewa", "mengecewakan", "rugi",
    "zonk", "gagal", "kapok", "nyesel", "menyesal", "busuk", "basi", "bau",
    "sampah", "ampas", "abal", "tipu", "bohong", "palsu", "rusak", "cacat",
    "malas", "males", "kesal", "marah", "sebal", "sebel", "bete", "bt",
    "menyedihkan", "mengerikan", "hancur", "ancur", "payah", "terburuk",
    # Intensifier
    "banget", "bgt", "bngt", "bangett", "sekali", "sangat", "amat", "super",
    "lumayan", "cukup", "kurang", "lebih", "terlalu", "parah", "poll", "pol",
    # Slang umum
    "wkwk", "wkwkwk", "haha", "hahaha", "hihi", "kwkw", "awkwk", "xixi",
    "btw", "fyi", "imho", "imo", "otw", "asap",
}

def maybe_translate_id_to_en(text: str) -> str:
    """
    Heuristic translation: if text appears Indonesian (contains several common
    Indonesian stopwords), map known sentiment words to English to help the
    English-trained model. Unknown words are kept as-is.
    
    Enhanced version with comprehensive phrase mappings for better sentiment detection.
    """
    lower = (text or "").lower().strip()
    
    if not lower:
        return text
    
    # Phrase-level replacements to strengthen sentiment cues (LONGER phrases first!)
    # Order matters: longer phrases should be matched before shorter ones
    phrase_map = [
        # ============= NEGASI (HARUS DI ATAS - PRIORITAS TINGGI) =============
        # Negasi "suka" → "hate/dislike"
        ("tidak suka sama sekali", "really hate"),
        ("tidak suka banget", "really hate"),
        ("tidak suka", "dislike"),
        ("ga suka sama sekali", "really hate"),
        ("ga suka banget", "really hate"),
        ("ga suka", "dislike"),
        ("gak suka sama sekali", "really hate"),
        ("gak suka banget", "really hate"),
        ("gak suka", "dislike"),
        ("gk suka", "dislike"),
        ("g suka", "dislike"),
        ("nggak suka", "dislike"),
        ("ngga suka", "dislike"),
        ("enggak suka", "dislike"),
        ("tak suka", "dislike"),
        ("tdk suka", "dislike"),
        ("ndak suka", "dislike"),
        ("kagak suka", "dislike"),
        ("ogah", "refuse"),
        
        # Negasi "enak" → "not tasty"
        ("tidak enak sama sekali", "really not tasty"),
        ("tidak enak banget", "really not tasty"),
        ("tidak enak", "not tasty"),
        ("ga enak banget", "really not tasty"),
        ("ga enak", "not tasty"),
        ("gak enak banget", "really not tasty"),
        ("gak enak", "not tasty"),
        ("gk enak", "not tasty"),
        ("nggak enak", "not tasty"),
        ("ngga enak", "not tasty"),
        ("enggak enak", "not tasty"),
        ("kurang enak", "not tasty"),
        
        # Negasi "bagus" → "not good"
        ("tidak bagus sama sekali", "really not good"),
        ("tidak bagus banget", "really bad"),
        ("tidak bagus", "not good"),
        ("ga bagus banget", "really bad"),
        ("ga bagus", "not good"),
        ("gak bagus banget", "really bad"),
        ("gak bagus", "not good"),
        ("gk bagus", "not good"),
        ("nggak bagus", "not good"),
        ("kurang bagus", "not good"),
        
        # Negasi "puas" → "not satisfied"
        ("tidak puas sama sekali", "really unsatisfied"),
        ("tidak puas banget", "really unsatisfied"),
        ("tidak puas", "unsatisfied"),
        ("ga puas", "unsatisfied"),
        ("gak puas", "unsatisfied"),
        ("kurang puas", "unsatisfied"),
        
        # Negasi "nyaman" → "uncomfortable"
        ("tidak nyaman", "uncomfortable"),
        ("ga nyaman", "uncomfortable"),
        ("gak nyaman", "uncomfortable"),
        ("kurang nyaman", "uncomfortable"),
        
        # Negasi "recommended" → "not recommended"
        ("tidak recommended", "not recommended"),
        ("ga recommended", "not recommended"),
        ("gak recommended", "not recommended"),
        ("tidak direkomendasikan", "not recommended"),
        ("ga direkomendasikan", "not recommended"),
        ("kurang recommended", "not recommended"),
        ("kurang rekomen", "not recommended"),
        
        # Negasi umum lainnya
        ("tidak worth it", "not worth it"),
        ("ga worth it", "not worth it"),
        ("gak worth it", "not worth it"),
        ("tidak worthit", "not worth it"),
        ("ga worthit", "not worth it"),
        ("tidak sesuai ekspektasi", "did not meet expectations"),
        ("tidak sesuai harapan", "did not meet expectations"),
        ("ga sesuai ekspektasi", "did not meet expectations"),
        ("tidak seperti yang diharapkan", "not as expected"),
        ("bukan yang terbaik", "not the best"),
        
        # ============= POSITIF SANGAT KUAT =============
        ("sangat sangat bagus", "extremely excellent"),
        ("sangat bagus sekali", "extremely good"),
        ("luar biasa banget", "absolutely amazing"),
        ("luar biasa sekali", "absolutely amazing"),
        ("super duper enak", "super delicious"),
        ("the best banget", "absolutely the best"),
        ("best of the best", "the very best"),
        ("paling enak sedunia", "the most delicious ever"),
        ("paling bagus banget", "the very best"),
        ("wajib banget dicoba", "absolutely must try"),
        ("wajib banget coba", "absolutely must try"),
        ("harus banget coba", "must definitely try"),
        ("recommended banget sih", "highly recommended"),
        ("recommended banget", "highly recommended"),
        ("super recommended", "highly recommended"),
        ("super enak banget", "super delicious"),
        ("enak banget parah", "extremely delicious"),
        ("enak parah banget", "extremely delicious"),
        ("mantap banget sih", "really great"),
        ("mantap parah banget", "extremely great"),
        ("puas banget sih", "really satisfied"),
        ("puas banget parah", "extremely satisfied"),
        ("suka banget parah", "really love it so much"),
        ("gila sih enak", "insanely delicious"),
        ("gila enak banget", "insanely delicious"),
        
        # ============= POSITIF KUAT =============
        ("sangat bagus", "very good"),
        ("bagus banget", "very good"),
        ("bagus bgt", "very good"),
        ("baguss banget", "very good"),
        ("enak banget", "very delicious"),
        ("enak bgt", "very delicious"),
        ("enakk banget", "very delicious"),
        ("mantap banget", "very great"),
        ("mantap bgt", "very great"),
        ("mantapp banget", "very great"),
        ("keren banget", "very cool"),
        ("keren bgt", "very cool"),
        ("puas banget", "very satisfied"),
        ("puas bgt", "very satisfied"),
        ("suka banget", "really love"),
        ("suka bgt", "really love"),
        ("wajib coba", "must try"),
        ("harus coba", "must try"),
        ("wajib dicoba", "must try"),
        ("harus dicoba", "must try"),
        ("cobain deh", "try it"),
        ("cobain aja", "just try it"),
        ("pasti balik lagi", "will definitely come back"),
        ("bakal balik lagi", "will come back"),
        ("mau balik lagi", "want to come back"),
        ("pengen balik lagi", "want to come back"),
        ("pasti kesini lagi", "will definitely come here again"),
        ("bakal kesini lagi", "will come here again"),
        ("the best", "the best"),
        ("top banget", "very top"),
        ("top bgt", "very top"),
        ("top markotop", "excellent"),
        ("jos gandos", "excellent"),
        ("mantap jiwa", "absolutely great"),
        ("mantap soul", "absolutely great"),
        ("kece badai", "super cool"),
        ("keren parah", "super cool"),
        ("gokil abis", "absolutely amazing"),
        ("gokil parah", "absolutely amazing"),
        
        # Ekspresi suka
        ("saya sangat suka", "i really love"),
        ("saya suka banget", "i really love"),
        ("saya suka sekali", "i really love"),
        ("saya suka tempat ini", "i love this place"),
        ("saya suka disini", "i love it here"),
        ("saya suka", "i love"),
        ("aku suka banget", "i really love"),
        ("aku suka sekali", "i really love"),
        ("aku suka", "i love"),
        ("gue suka banget", "i really love"),
        ("gue suka bgt", "i really love"),
        ("gue suka", "i love"),
        ("gw suka banget", "i really love"),
        ("gw suka", "i love"),
        ("kami suka", "we love"),
        ("kita suka", "we love"),
        
        # ============= NEGATIF SANGAT KUAT =============
        ("sangat sangat buruk", "extremely terrible"),
        ("buruk banget parah", "extremely bad"),
        ("jelek banget parah", "extremely bad"),
        ("parah banget sih", "really awful"),
        ("parah sih ini", "this is awful"),
        ("kecewa banget parah", "extremely disappointed"),
        ("mengecewakan banget", "very disappointing"),
        ("kapok banget kesini", "totally regret coming here"),
        ("nyesel banget kesini", "totally regret coming here"),
        ("ga bakal balik lagi", "will never come back"),
        ("gak bakal balik", "will never come back"),
        ("tidak akan balik", "will never come back"),
        ("rugi banget kesini", "totally wasted coming here"),
        ("buang duit aja", "waste of money"),
        ("buang uang doang", "waste of money"),
        ("sampah banget", "total trash"),
        ("ampas banget", "total trash"),
        
        # ============= NEGATIF KUAT =============
        ("sangat buruk", "very bad"),
        ("sangat jelek", "very bad"),
        ("sangat mengecewakan", "very disappointing"),
        ("buruk banget", "very bad"),
        ("buruk bgt", "very bad"),
        ("jelek banget", "very bad"),
        ("jelek bgt", "very bad"),
        ("parah banget", "very awful"),
        ("parah bgt", "very awful"),
        ("kecewa banget", "very disappointed"),
        ("kecewa bgt", "very disappointed"),
        ("mahal banget", "very expensive"),
        ("mahal bgt", "very expensive"),
        ("kemahalan banget", "way too expensive"),
        ("lama banget", "very slow"),
        ("lama bgt", "very slow"),
        ("lambat banget", "very slow"),
        ("lambat bgt", "very slow"),
        ("lemot banget", "very slow"),
        ("kotor banget", "very dirty"),
        ("kotor bgt", "very dirty"),
        ("jorok banget", "very dirty"),
        ("bau banget", "very smelly"),
        ("busuk banget", "very rotten"),
        ("tidak akan kesini lagi", "will never come here again"),
        ("ga akan kesini lagi", "will never come here again"),
        ("gak akan kesini lagi", "will never come here again"),
        ("gak akan balik", "will never come back"),
        ("ga bakal kesini", "will never come here"),
        ("kapok kesini", "regret coming here"),
        ("kapok deh", "totally regret"),
        ("nyesel kesini", "regret coming here"),
        ("nyesel banget", "really regret"),
        ("zonk banget", "totally a letdown"),
        ("zonk parah", "totally a letdown"),
        ("rugi kesini", "waste coming here"),
        
        # Ekspresi benci
        ("saya sangat benci", "i really hate"),
        ("saya benci banget", "i really hate"),
        ("saya benci sekali", "i really hate"),
        ("saya benci tempat ini", "i hate this place"),
        ("saya benci", "i hate"),
        ("saya kecewa banget", "i am very disappointed"),
        ("saya kecewa sekali", "i am very disappointed"),
        ("saya kecewa", "i am disappointed"),
        ("saya tidak suka", "i don't like"),
        ("saya ga suka", "i don't like"),
        ("saya gak suka", "i don't like"),
        ("aku benci banget", "i really hate"),
        ("aku benci", "i hate"),
        ("aku kecewa", "i am disappointed"),
        ("gue benci banget", "i really hate"),
        ("gue benci", "i hate"),
        ("gue kecewa", "i am disappointed"),
        ("gw benci", "i hate"),
        
        # ============= NETRAL =============
        ("menurut saya biasa saja", "in my opinion average"),
        ("menurut saya biasa aja", "in my opinion average"),
        ("menurut saya biasa", "in my opinion average"),
        ("menurutku biasa saja", "in my opinion average"),
        ("menurutku biasa aja", "in my opinion average"),
        ("biasa saja sih", "just average"),
        ("biasa aja sih", "just average"),
        ("biasa saja", "average"),
        ("biasa aja", "average"),
        ("ya gitu aja", "just so-so"),
        ("ya gitu deh", "just so-so"),
        ("ya gitu lah", "just so-so"),
        ("gitu aja sih", "just okay"),
        ("lumayan lah", "quite okay"),
        ("lumayan sih", "quite okay"),
        ("lumayan aja", "quite okay"),
        ("so so lah", "so so"),
        ("so so aja", "so so"),
        ("standar sih", "standard"),
        ("standar aja", "standard"),
        ("cukupan lah", "adequate"),
        ("cukup lah", "adequate"),
        ("menurut saya", "in my opinion"),
        ("menurutku", "in my opinion"),
        ("menurut gue", "in my opinion"),
        ("menurut gw", "in my opinion"),
        
        # ============= MAKANAN / MINUMAN =============
        ("makanannya enak banget", "the food is very delicious"),
        ("makanannya enak bgt", "the food is very delicious"),
        ("makanannya sangat enak", "the food is very delicious"),
        ("makanannya enak", "the food is delicious"),
        ("makanan enak banget", "very delicious food"),
        ("makanan enak", "delicious food"),
        ("makanannya tidak enak", "the food is not tasty"),
        ("makanannya ga enak", "the food is not tasty"),
        ("makanannya gak enak", "the food is not tasty"),
        ("makanannya hambar", "the food is bland"),
        ("makanannya kurang", "the food is lacking"),
        ("minumannya enak banget", "the drink is very delicious"),
        ("minumannya enak", "the drink is delicious"),
        ("minumannya segar", "the drink is fresh"),
        ("minumannya hambar", "the drink is bland"),
        ("kopinya enak", "the coffee is delicious"),
        ("kopinya pahit", "the coffee is bitter"),
        ("nasinya enak", "the rice is delicious"),
        ("nasinya pulen", "the rice is fluffy"),
        ("dagingnya empuk", "the meat is tender"),
        ("dagingnya alot", "the meat is chewy"),
        ("porsinya banyak", "the portion is big"),
        ("porsinya sedikit", "the portion is small"),
        ("porsinya pas", "the portion is just right"),
        
        # ============= PELAYANAN =============
        ("pelayanannya sangat baik", "the service is very good"),
        ("pelayanannya baik banget", "the service is very good"),
        ("pelayanannya baik sekali", "the service is very good"),
        ("pelayanannya ramah banget", "the service is very friendly"),
        ("pelayanannya ramah sekali", "the service is very friendly"),
        ("pelayanannya cepat banget", "the service is very fast"),
        ("pelayanannya responsif", "the service is responsive"),
        ("pelayanannya buruk banget", "the service is very bad"),
        ("pelayanannya buruk sekali", "the service is very bad"),
        ("pelayanannya lambat banget", "the service is very slow"),
        ("pelayanannya jutek", "the service is rude"),
        ("pelayanannya buruk", "bad service"),
        ("pelayanannya baik", "good service"),
        ("pelayanannya ramah", "friendly service"),
        ("pelayanannya cepat", "fast service"),
        ("pelayanan lambat", "slow service"),
        ("pelayanan cepat", "fast service"),
        ("admin ramah", "friendly admin"),
        ("admin responsif", "responsive admin"),
        ("admin slow", "slow admin"),
        ("admin lambat", "slow admin"),
        ("respon cepat", "fast response"),
        ("respon lambat", "slow response"),
        
        # ============= TEMPAT =============
        ("tempatnya bagus banget", "the place is very good"),
        ("tempatnya bagus sekali", "the place is very good"),
        ("tempatnya nyaman banget", "the place is very comfortable"),
        ("tempatnya nyaman sekali", "the place is very comfortable"),
        ("tempatnya cozy banget", "the place is very cozy"),
        ("tempatnya bersih banget", "the place is very clean"),
        ("tempatnya aesthetic", "the place is aesthetic"),
        ("tempatnya instagramable", "the place is instagrammable"),
        ("tempatnya enak", "nice place"),
        ("tempatnya bagus", "good place"),
        ("tempatnya nyaman", "comfortable place"),
        ("tempatnya bersih", "clean place"),
        ("tempatnya kotor banget", "the place is very dirty"),
        ("tempatnya kotor", "the place is dirty"),
        ("tempatnya jorok", "the place is filthy"),
        ("tempatnya sempit banget", "the place is very cramped"),
        ("tempatnya sempit", "the place is cramped"),
        ("tempatnya luas", "the place is spacious"),
        ("tempatnya pengap", "the place is stuffy"),
        ("tempatnya panas", "the place is hot"),
        ("tempatnya dingin", "the place is cold"),
        ("tempatnya adem", "the place is cool"),
        ("suasananya enak", "nice atmosphere"),
        ("suasananya nyaman", "comfortable atmosphere"),
        ("vibesnya enak", "nice vibes"),
        
        # ============= HARGA =============
        ("harganya murah banget", "the price is very cheap"),
        ("harganya murah sekali", "the price is very cheap"),
        ("harganya sangat murah", "the price is very cheap"),
        ("harganya terjangkau banget", "the price is very affordable"),
        ("harganya mahal banget", "the price is very expensive"),
        ("harganya mahal sekali", "the price is very expensive"),
        ("harganya sangat mahal", "the price is very expensive"),
        ("harganya kemahalan", "the price is too expensive"),
        ("harganya terjangkau", "the price is affordable"),
        ("harganya worth it banget", "the price is very worth it"),
        ("harganya worth it", "the price is worth it"),
        ("harganya worthit", "the price is worth it"),
        ("harganya sesuai", "the price is appropriate"),
        ("harganya pas", "the price is just right"),
        ("harga tidak sesuai", "the price is not worth it"),
        ("harga gak sesuai", "the price is not worth it"),
        ("harga ga sesuai", "the price is not worth it"),
        ("murah meriah", "cheap and cheerful"),
        ("mahal tapi worth it", "expensive but worth it"),
        ("mahal tapi enak", "expensive but delicious"),
        
        # ============= PENGIRIMAN / DELIVERY =============
        ("pengirimannya cepat banget", "the delivery is very fast"),
        ("pengirimannya cepat", "fast delivery"),
        ("pengirimannya lambat banget", "the delivery is very slow"),
        ("pengirimannya lambat", "slow delivery"),
        ("packingnya rapi", "neat packaging"),
        ("packingnya aman", "safe packaging"),
        ("packingnya asal", "careless packaging"),
        ("sampainya cepat", "arrived quickly"),
        ("sampainya lama", "took long to arrive"),
        ("ongkirnya murah", "cheap shipping"),
        ("ongkirnya mahal", "expensive shipping"),
        
        # ============= KUALITAS =============
        ("kualitasnya bagus banget", "the quality is very good"),
        ("kualitasnya bagus", "good quality"),
        ("kualitasnya jelek", "bad quality"),
        ("kualitasnya buruk", "bad quality"),
        ("barangnya bagus", "the item is good"),
        ("barangnya jelek", "the item is bad"),
        ("barangnya ori", "the item is original"),
        ("barangnya asli", "the item is authentic"),
        ("barangnya palsu", "the item is fake"),
        ("barangnya kw", "the item is fake"),
        ("produknya bagus", "the product is good"),
        ("produknya jelek", "the product is bad"),
        ("sesuai deskripsi", "as described"),
        ("sesuai foto", "as pictured"),
        ("tidak sesuai", "not as expected"),
        ("gak sesuai", "not as expected"),
        ("ga sesuai", "not as expected"),
    ]
    
    # Apply phrase replacements (longer phrases first)
    for src, dst in phrase_map:
        if src in lower:
            lower = lower.replace(src, dst)

    # Check if text appears to be Indonesian
    tokens = re.findall(r"[a-zA-Z']+", lower)
    hits = sum(1 for w in ID_HINT_WORDS if w in lower.split())
    map_hits = sum(1 for tok in tokens if tok in ID_TO_EN_MAP)
    
    # If no Indonesian markers detected, return original text
    if hits < 1 and map_hits < 1:
        return text  # assume already English or mixed

    # Translate remaining individual words
    translated = []
    for tok in tokens:
        translated.append(ID_TO_EN_MAP.get(tok, tok))
    
    return " ".join(translated)

def _load_pickle(path: str):
    if not os.path.exists(path):
        return None
    try:
        with open(path, "rb") as f:
            return pickle.load(f)
    except Exception as e:
        logger.error(f"Failed to load pickle {path}: {e}")
        return None

SENTIMENT_MODEL = _load_pickle(SENTIMENT_MODEL_PATH)
TFIDF_VECTORIZER = _load_pickle(TFIDF_PATH)

def clean_text(text: str) -> str:
    lowered = (text or "").lower()
    cleaned = re.sub(r'[^a-z\\s]', ' ', lowered)
    tokens = [w for w in cleaned.split() if w and w not in STOPWORDS]
    stemmed = [STEMMER.stem(w) for w in tokens]
    return ' '.join(stemmed).strip()

def predict_sentiment(text: str):
    original_lower = (text or "").lower()
    source_text = maybe_translate_id_to_en(text or "")
    cleaned = clean_text(source_text)
    label = "Neutral"
    confidence = 0.5

    model_success = False
    if SENTIMENT_MODEL is not None and TFIDF_VECTORIZER is not None and cleaned:
        try:
            vector = TFIDF_VECTORIZER.transform([cleaned])
            proba = SENTIMENT_MODEL.predict_proba(vector)[0]
            idx = int(np.argmax(proba))
            if hasattr(SENTIMENT_MODEL, "classes_") and len(SENTIMENT_MODEL.classes_) > idx:
                cls = SENTIMENT_MODEL.classes_[idx]
                if isinstance(cls, (int, float, np.integer)):
                    label = "Positive" if cls == 1 else "Negative"
                else:
                    label = str(cls).capitalize()
            else:
                label = "Positive" if idx == 1 else "Negative"
            confidence = float(proba[idx])
            model_success = True
        except Exception as e:
            logger.error(f"Inference error, fallback to heuristic: {e}")

    # Lexical heuristic boost (English side, post-translation) to avoid neutral drift
    lower_src = (source_text or "").lower()
    
    # ============= NEGATION OVERRIDE - CHECK FIRST =============
    # These negation patterns ALWAYS indicate negative sentiment and override model
    negation_patterns = [
        # Negasi "suka"
        "tidak suka", "ga suka", "gak suka", "gk suka", "g suka",
        "nggak suka", "ngga suka", "enggak suka", "tak suka", "tdk suka",
        "ndak suka", "kagak suka",
        # Negasi "enak"
        "tidak enak", "ga enak", "gak enak", "gk enak", "nggak enak", 
        "ngga enak", "enggak enak", "kurang enak",
        # Negasi "bagus"
        "tidak bagus", "ga bagus", "gak bagus", "gk bagus", "nggak bagus",
        "kurang bagus",
        # Negasi "puas"
        "tidak puas", "ga puas", "gak puas", "kurang puas",
        # Negasi "nyaman"
        "tidak nyaman", "ga nyaman", "gak nyaman", "kurang nyaman",
        # Negasi recommended
        "tidak recommended", "ga recommended", "gak recommended",
        "tidak direkomendasikan", "ga direkomendasikan",
        "tidak rekomen", "ga rekomen", "gak rekomen",
        # Negasi worth
        "tidak worth", "ga worth", "gak worth",
        # English negations (from translation)
        "dislike", "don't like", "dont like", "do not like",
        "not tasty", "not good", "not recommended", "not worth",
        "unsatisfied", "uncomfortable",
    ]
    
    # Check for negation pattern FIRST - this overrides everything
    negation_hit = any(neg_pattern in original_lower for neg_pattern in negation_patterns)
    negation_hit_en = any(neg_pattern in lower_src for neg_pattern in negation_patterns)
    
    if negation_hit or negation_hit_en:
        # Negation detected - force negative sentiment
        label = "Negative"
        confidence = max(confidence, 0.85)  # High confidence for negation
        emoji = "😞"
        return {
            "sentiment": label,
            "confidence": round(confidence * 100, 2),
            "emoji": emoji,
            "cleaned": cleaned,
        }
    
    # ============= END NEGATION OVERRIDE =============
    
    # Strong positive cues (English)
    pos_cues = [
        "recommended", "recommend", "love", "great", "excellent",
        "amazing", "awesome", "delicious", "friendly", "worth", "worth it",
        "very good", "good service", "good place", "highly", "must try",
        "perfect", "best", "fantastic", "wonderful",
    ]
    # Strong positive cues (Indonesian)
    pos_cues_id = [
        "suka banget", "enak banget", "bagus banget", "mantap banget", 
        "recommended", "rekomen", "rekomendasi", "terbaik", "sempurna",
        "puas banget", "favorit", "gokil", "kece", "mantul", "wajib coba",
    ]
    # Weaker positive (to be excluded when neutral indicators present)
    weak_pos_id = ["suka", "cinta", "bagus", "enak", "mantap", "puas"]
    
    # Strong negative cues (English)
    neg_cues = [
        "hate", "bad", "terrible", "awful", "worst", "disappoint", 
        "dirty", "smelly", "expensive", "slow", "regret", "never come back",
        "horrible", "disgusting", "waste",
    ]
    # Strong negative cues (Indonesian)
    neg_cues_id = [
        "benci", "buruk banget", "jelek banget", "kotor banget", "mahal banget",
        "parah banget", "kecewa banget", "mengecewakan", "kapok", "nyesel", 
        "sampah", "zonk", "gagal",
    ]
    # Weaker negative (to be excluded when neutral indicators present)
    weak_neg_id = ["buruk", "jelek", "kotor", "bau", "mahal", "lambat", "lemot", "parah"]
    
    # Neutral cues (English)
    neu_cues = ["average", "ordinary", "so so", "so-so", "standard", "just okay", "adequate"]
    # Neutral cues (Indonesian) - check these FIRST
    neu_cues_id = [
        "biasa saja", "biasa aja", "biasa", "standar", "lumayan", "cukupan",
        "ya gitu", "gitu aja", "so so", "begitu lah", "begitulah",
        "tidak terlalu", "gak terlalu", "ga terlalu", "kurang lebih",
    ]

    # Check for neutral indicators first (they take priority for ambiguous cases)
    neu_hit_id = any(w in original_lower for w in neu_cues_id)
    neu_hit = any(w in lower_src for w in neu_cues) or neu_hit_id
    
    # Check for strong positive/negative hits
    pos_hit_strong = any(w in lower_src for w in pos_cues) or any(w in original_lower for w in pos_cues_id)
    neg_hit_strong = any(w in lower_src for w in neg_cues) or any(w in original_lower for w in neg_cues_id)
    
    # Check for weak positive/negative (only count if no neutral indicator)
    pos_hit_weak = any(w in original_lower for w in weak_pos_id) if not neu_hit else False
    neg_hit_weak = any(w in original_lower for w in weak_neg_id) if not neu_hit else False
    
    # Combine hits
    pos_hit = pos_hit_strong or pos_hit_weak
    neg_hit = neg_hit_strong or neg_hit_weak

    # Handle neutral cases first - if neutral indicators are present and no strong pos/neg
    if neu_hit and not pos_hit_strong and not neg_hit_strong:
        label = "Neutral"
        confidence = max(0.65, min(confidence, 0.75))  # Cap confidence for neutral
    # If model missing or low confidence (<0.6), lean on cues
    elif (not model_success) or confidence < 0.6:
        if pos_hit and not neg_hit:
            label = "Positive"
            confidence = max(confidence, 0.78)
        elif neg_hit and not pos_hit:
            label = "Negative"
            confidence = max(confidence, 0.78)
        elif neu_hit:
            label = "Neutral"
            confidence = max(confidence, 0.65)

    if not model_success:
        # Additional heuristic if still neutral
        if neu_hit and not pos_hit_strong and not neg_hit_strong:
            label = "Neutral"
            confidence = max(confidence, 0.7)
        elif pos_hit and not neg_hit:
            label = "Positive"
            confidence = max(confidence, 0.8)
        elif neg_hit and not pos_hit:
            label = "Negative"
            confidence = max(confidence, 0.8)

    emoji = "😊" if label.lower() == "positive" else "😐" if label.lower() == "neutral" else "😞"
    return {
        "sentiment": label,
        "confidence": round(confidence * 100, 2),
        "emoji": emoji,
        "cleaned": cleaned,
    }


def sanitize_product_id(product_id: str) -> str:
    """
    Sanitize product ID to prevent path traversal attacks
    Only allows alphanumeric, underscore, hyphen, and space
    """
    safe_id = re.sub(r'[^a-zA-Z0-9_\-\s]', '', product_id)
    if not safe_id or len(safe_id) > 100:
        raise HTTPException(status_code=400, detail="Invalid product_id format")
    return safe_id


def get_all_product_ids_from_models() -> List[str]:
    """Get all product IDs from available models"""
    product_ids: List[str] = []

    training_dir = os.path.join(BASE_DIR, "training", "models_output")
    logger.info(f"Scanning training dir: {training_dir}")
    
    if os.path.exists(training_dir):
        try:
            for file in os.listdir(training_dir):
                if file.startswith("xgboost_") and file.endswith(".pkl"):
                    pid = file.replace("xgboost_", "").replace(".pkl", "")
                    if pid not in product_ids:
                        product_ids.append(pid)
        except Exception as e:
            logger.error(f"Error scanning training dir: {e}")

    models_dir = os.path.join(BASE_DIR, "models")
    if os.path.exists(models_dir):
        try:
            for file in os.listdir(models_dir):
                if file.startswith("xgboost_") and file.endswith(".pkl"):
                    pid = file.replace("xgboost_", "").replace(".pkl", "")
                    if pid not in product_ids:
                        product_ids.append(pid)
        except Exception as e:
            logger.error(f"Error scanning models dir: {e}")

    artifacts_dir = os.path.join(BASE_DIR, "models", "artifacts")
    if os.path.exists(artifacts_dir):
        try:
            for file in os.listdir(artifacts_dir):
                if file.startswith("xgboost_") and file.endswith(".pkl"):
                    pid = file.replace("xgboost_", "").replace(".pkl", "")
                    if pid not in product_ids:
                        product_ids.append(pid)
        except Exception as e:
            logger.error(f"Error scanning artifacts dir: {e}")

    logger.info(f"Found {len(product_ids)} product IDs")
    return product_ids


# Pydantic models
class TrainRequest(BaseModel):
    product_id: str
    sales_data: List[Dict]


class ForecastRequest(BaseModel):
    product_id: str
    days: int = 7

    @validator('days')
    def validate_days(cls, v):
        if v < 1 or v > 30:
            raise ValueError('days must be between 1 and 30')
        return v


class HybridForecastRequest(BaseModel):
    product_id: str
    realtime_data: Dict
    days: int = 7

    @validator('days')
    def validate_days(cls, v):
        if v < 1 or v > 30:
            raise ValueError('days must be between 1 and 30')
        return v


class UniversalPredictRequest(BaseModel):
    """Request model for universal prediction endpoint"""
    sales_data: List[Dict] = Field(..., min_items=3, max_items=MAX_SALES_DATA_POINTS)
    forecast_days: int = Field(default=7, ge=1, le=MAX_FORECAST_DAYS)
    product_id: Optional[str] = Field(default=None, max_length=MAX_PRODUCT_ID_LENGTH)

    @validator('sales_data')
    def validate_sales_data(cls, v):
        if not v or len(v) < 3:
            raise ValueError('sales_data must have at least 3 data points')
        if len(v) > MAX_SALES_DATA_POINTS:
            raise ValueError(f'sales_data cannot exceed {MAX_SALES_DATA_POINTS} data points')
        return v


class SentimentTextRequest(BaseModel):
    text: str


@app.get("/")
def root():
    return {
        "service": "AI Market Pulse ML Service",
        "status": "running",
        "version": "1.1.0",
        "base_dir": BASE_DIR
    }


@app.get("/health")
def health_check():
    """Health check endpoint for deployment monitoring"""
    return {
        "status": "healthy",
        "service": "ml",
        "timestamp": datetime.now().isoformat(),
        "cache_stats": model_cache.stats()
    }


@app.get("/api/ml/cache/stats")
def cache_stats():
    """Get model cache statistics"""
    return {
        "success": True,
        "cache": model_cache.stats()
    }


@app.post("/api/ml/cache/clear")
def clear_cache():
    """Clear model cache and run garbage collection"""
    model_cache.clear()
    gc.collect()
    return {
        "success": True,
        "message": "Cache cleared",
        "cache": model_cache.stats()
    }


@app.post("/api/sentiment/analyze-text")
def analyze_text(request: SentimentTextRequest):
    text = (request.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    result = predict_sentiment(text)
    return {"success": True, "result": result}


@app.post("/api/sentiment/analyze-file")
async def analyze_file(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="file is required")
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    content = await file.read()
    try:
        # Support semicolon or comma delimiter; try auto first, fallback to semicolon
        try:
            df = pd.read_csv(io.BytesIO(content), encoding="utf-8", on_bad_lines="skip")
        except Exception:
            df = pd.read_csv(io.BytesIO(content), sep=";", encoding="utf-8", on_bad_lines="skip")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {e}")

    # Support multiple possible text column names
    text_col = None
    for cand in ["Review", "review", "text", "clean_review"]:
        if cand in df.columns:
            text_col = cand
            break
    if not text_col:
        raise HTTPException(status_code=400, detail="CSV must contain a text column (Review/text/clean_review)")

    results = []
    positive = negative = neutral = 0

    for _, row in df.iterrows():
        raw_val = row[text_col]
        text = str(raw_val) if not pd.isna(raw_val) else ""
        sentiment_result = predict_sentiment(text)
        sentiment = sentiment_result["sentiment"].lower()
        if sentiment == "positive":
            positive += 1
        elif sentiment == "negative":
            negative += 1
        else:
            neutral += 1
        results.append({
            "review": text,
            "sentiment": sentiment_result["sentiment"],
            "confidence": sentiment_result["confidence"],
            "emoji": sentiment_result["emoji"],
        })

    total = max(1, len(results))
    summary = {
        "positive": positive,
        "negative": negative,
        "neutral": neutral,
        "positive_pct": round(positive / total * 100, 2),
        "negative_pct": round(negative / total * 100, 2),
        "neutral_pct": round(neutral / total * 100, 2),
        "total": total,
    }

    return {
        "success": True,
        "summary": summary,
        "results": results,
    }


@app.get("/api/ml/debug")
def debug_paths():
    """Debug endpoint to check paths"""
    training_dir = os.path.join(BASE_DIR, "training", "models_output")
    
    files = []
    if os.path.exists(training_dir):
        try:
            files = [f for f in os.listdir(training_dir) if f.endswith('.pkl')]
        except Exception as e:
            files = [f"Error: {e}"]
    
    product_ids = get_all_product_ids_from_models()
    
    return {
        "BASE_DIR": BASE_DIR,
        "training_dir": training_dir,
        "dir_exists": os.path.exists(training_dir),
        "files_count": len(files),
        "sample_files": files[:5],
        "product_ids_count": len(product_ids),
        "sample_product_ids": product_ids[:5]
    }


@app.get("/api/ml/models")
def list_models():
    """List all trained models"""
    try:
        models = []
        product_ids = get_all_product_ids_from_models()
        
        logger.info(f"Processing {len(product_ids)} product IDs")
        
        for product_id in product_ids:
            model_path = None
            for candidate in [
                os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{product_id}.pkl"),
                os.path.join(BASE_DIR, "models", f"xgboost_{product_id}.pkl"),
                os.path.join(BASE_DIR, "models", "artifacts", f"xgboost_{product_id}.pkl")
            ]:
                if os.path.exists(candidate):
                    model_path = candidate
                    break
            
            if not model_path:
                continue
            
            metadata_path = model_path.replace('.pkl', '_metadata.json')
            metadata = {}
            if os.path.exists(metadata_path):
                try:
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                except Exception as e:
                    logger.warning(f"Failed to load metadata for {product_id}: {e}")
            
            models.append({
                'product_id': product_id,
                'model_path': model_path,
                'trained_at': metadata.get('generated_at', 'unknown'),
                'metrics': metadata.get('physics_metrics', {})
            })

        logger.info(f"Returning {len(models)} models")
        
        return {
            'success': True,
            'models': models,
            'total': len(models)
        }

    except Exception as e:
        logger.error(f"list_models error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ml/forecast")
def get_forecast(productId: str, days: int = Query(7, ge=1, le=30)):
    """Get ML forecast for product"""
    try:
        # Sanitize product ID to prevent path traversal
        productId = sanitize_product_id(productId)
        logger.info(f"Forecast request for: {productId}, days: {days}")
        
        model_candidates = [
            os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{productId}.pkl"),
            os.path.join(BASE_DIR, "models", f"xgboost_{productId}.pkl"),
            os.path.join(BASE_DIR, "models", "artifacts", f"xgboost_{productId}.pkl"),
        ]

        model_path: Optional[str] = None
        for path in model_candidates:
            logger.info(f"Checking: {path} - Exists: {os.path.exists(path)}")
            if os.path.exists(path):
                model_path = path
                logger.info(f"Found model for {productId}: {path}")
                break

        if not model_path:
            available_models = get_all_product_ids_from_models()
            logger.error(f"Model not found for product: {productId}")
            raise HTTPException(
                status_code=404,
                detail={
                    "error": f"Model not found for product: {productId}",
                    "available_models": available_models[:10],
                    "total_models": len(available_models),
                    "suggestion": "Check product_id spelling or train a model first"
                }
            )

        # Check cache first
        cache_key = f"forecast_{productId}"
        cached_forecaster = model_cache.get(cache_key)
        
        if cached_forecaster:
            logger.info(f"Cache hit for {productId}")
            product_forecaster = cached_forecaster
        else:
            logger.info(f"Cache miss for {productId}, loading model...")
            product_forecaster = HybridBrain(product_id=productId)
            success = product_forecaster.load_model(productId, model_path)
            if not success:
                logger.error(f"Failed to load model for product: {productId} from {model_path}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Model file found but failed to load. It may be corrupted. Try retraining the model."
                )
            # Cache the loaded model
            model_cache.set(cache_key, product_forecaster)

        logger.info(f"Generating predictions for {productId}...")
        predictions = product_forecaster.predict_next_days(days)

        # Safety check for empty predictions
        if not predictions or len(predictions) == 0:
            logger.error(f"Model returned empty predictions for {productId}")
            raise HTTPException(
                status_code=500,
                detail={
                    'error': 'Model failed to generate predictions',
                    'productId': productId,
                    'suggestion': 'Model may need retraining with more data'
                }
            )

        first_pred = predictions[0].get('predicted_quantity', 0)
        last_pred = predictions[-1].get('predicted_quantity', 0)

        return {
            'success': True,
            'productId': productId,
            'model_loaded': model_path,
            'predictions': predictions,
            'data_quality_days': 60,
            'debug': {
                'first_pred': first_pred,
                'last_pred': last_pred,
                'avg_pred': float(sum(p.get('predicted_quantity', 0) for p in predictions) / len(predictions)),
                'model_mae': product_forecaster.mae,
                'model_std_error': product_forecaster.std_error,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Forecast error for {productId}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/predict-universal")
def predict_universal(request: UniversalPredictRequest):
    """
    Universal prediction endpoint - works with any sales data without pre-trained model.
    Uses physics-based prediction with on-the-fly training.
    
    Optimized for large datasets (30k-50k rows).
    """
    import pandas as pd
    import numpy as np
    
    try:
        sales_data = request.sales_data
        forecast_days = request.forecast_days
        product_id = request.product_id or "universal"
        data_size = len(sales_data)

        logger.info(f"Universal predict: {data_size} data points, {forecast_days} days forecast")

        if not sales_data:
            raise HTTPException(status_code=400, detail="sales_data cannot be empty")

        # OPTIMIZED: For large datasets, use chunked processing
        try:
            if data_size > CHUNK_SIZE:
                # Process in chunks for memory efficiency
                logger.info(f"Large dataset detected, processing in chunks...")
                chunks = []
                for i in range(0, data_size, CHUNK_SIZE):
                    chunk_data = sales_data[i:i + CHUNK_SIZE]
                    chunk_df = pd.DataFrame(chunk_data)
                    chunks.append(chunk_df)
                df = pd.concat(chunks, ignore_index=True)
                del chunks  # Free memory
            else:
                df = pd.DataFrame(sales_data)
            
            if 'date' not in df.columns or 'quantity' not in df.columns:
                raise HTTPException(
                    status_code=400,
                    detail="sales_data must contain 'date' and 'quantity' fields"
                )

            # OPTIMIZED: Use more efficient dtypes
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0).astype(np.float32)
            
            # Drop invalid dates
            df = df.dropna(subset=['date'])
            
            # Sort and dedupe efficiently
            df = df.sort_values('date').drop_duplicates(subset=['date'], keep='last')
            
            # For very large datasets, sample recent data for faster prediction
            if len(df) > 365:
                logger.info(f"Sampling last 365 days from {len(df)} data points for faster prediction")
                df = df.tail(365)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Data parsing error: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid sales_data format: {str(e)}")

        # Try to load existing model first if product_id is provided
        model_loaded = False
        brain = HybridBrain(product_id=product_id)

        if product_id and product_id != "universal":
            model_candidates = [
                os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{product_id}.pkl"),
                os.path.join(BASE_DIR, "models", f"xgboost_{product_id}.pkl"),
                os.path.join(BASE_DIR, "models", "artifacts", f"xgboost_{product_id}.pkl"),
            ]

            for path in model_candidates:
                if os.path.exists(path):
                    if brain.load_model(product_id, path):
                        model_loaded = True
                        logger.info(f"Loaded existing model for {product_id}")
                        break

        # If no model loaded, train on-the-fly with the provided data
        if not model_loaded:
            logger.info(f"No model found, training on-the-fly with {len(df)} data points")

            # Prepare training data
            training_data = df.to_dict('records')
            for row in training_data:
                row['date'] = row['date'].strftime('%Y-%m-%d') if hasattr(row['date'], 'strftime') else str(row['date'])

            # Train the model
            try:
                brain.train(training_data, product_id)
            except Exception as train_err:
                logger.warning(f"Training failed: {train_err}, using physics-based fallback")
                # Continue anyway - brain will use physics-based predictions

        # Generate predictions
        predictions = brain.predict_next_days(forecast_days)

        if not predictions:
            # Fallback to simple physics-based prediction
            logger.warning("Model predictions empty, generating fallback")
            predictions = _generate_fallback_predictions(df, forecast_days)

        # Calculate confidence based on data quality
        data_quality = min(1.0, len(df) / 30)  # Max confidence at 30 days of data

        # Detect momentum from data
        momentum = _calculate_momentum(df)

        # Detect burst
        burst = _detect_burst(df)

        result = {
            'success': True,
            'product_id': product_id,
            'model_type': 'trained' if model_loaded else 'on-the-fly',
            'predictions': predictions,
            'data_points': len(df),
            'data_quality': round(data_quality, 2),
            'momentum': momentum,
            'burst': burst,
            'generated_at': datetime.now().isoformat()
        }
        
        # Cleanup DataFrame to free memory
        del df
        gc.collect()
        
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Universal predict error: {e}", exc_info=True)
        gc.collect()  # Cleanup on error too
        raise HTTPException(status_code=500, detail=str(e))


def _generate_fallback_predictions(df, days: int) -> List[Dict]:
    """Generate physics-based predictions - adaptive based on data quantity"""
    import pandas as pd
    import numpy as np

    if df.empty:
        return []

    data_len = len(df)
    
    # Determine data tier and scaling factors
    if data_len >= 60:  # 2+ months
        variation_scale = 1.0
        trend_sensitivity = 0.15
        dow_clamp = (0.80, 1.25)
        confidence = 'HIGH'
    elif data_len >= 30:  # 1+ month
        variation_scale = 0.8
        trend_sensitivity = 0.12
        dow_clamp = (0.85, 1.20)
        confidence = 'MEDIUM'
    elif data_len >= 14:  # 2+ weeks
        variation_scale = 0.6
        trend_sensitivity = 0.08
        dow_clamp = (0.88, 1.15)
        confidence = 'MEDIUM'
    elif data_len >= 7:  # 1+ week
        variation_scale = 0.4
        trend_sensitivity = 0.05
        dow_clamp = (0.92, 1.10)
        confidence = 'LOW'
    else:  # < 7 days - very conservative
        variation_scale = 0.2
        trend_sensitivity = 0.02
        dow_clamp = (0.95, 1.05)
        confidence = 'LOW'

    # Calculate baseline and trend from recent data
    recent = df.tail(min(14, data_len))
    baseline = recent['quantity'].mean() if len(recent) > 0 else 1
    std = recent['quantity'].std() if len(recent) > 1 else max(baseline * 0.2, 1)
    
    # Calculate trend
    trend = 0
    if len(recent) >= 3:
        first_half = recent.head(len(recent) // 2)['quantity'].mean()
        second_half = recent.tail(len(recent) // 2)['quantity'].mean()
        trend = (second_half - first_half) / len(recent) if first_half > 0 else 0

    predictions = []
    last_date = df['date'].max()

    # Default DOW factors (Weekend highest, Tuesday lowest - based on retail patterns)
    # 0=Monday, 1=Tuesday, ..., 5=Saturday, 6=Sunday
    default_dow = {0: 0.97, 1: 0.93, 2: 0.94, 3: 0.96, 4: 1.01, 5: 1.08, 6: 1.11}
    
    # Learn DOW patterns from data if enough data
    learned_dow = {}
    if data_len >= 7:
        dow_means = df.groupby(df['date'].dt.dayofweek)['quantity'].mean()
        global_mean = df['quantity'].mean()
        if global_mean > 0:
            for dow, mean_val in dow_means.items():
                raw_factor = mean_val / global_mean
                learned_dow[dow] = max(dow_clamp[0], min(dow_clamp[1], raw_factor))

    prev_pred = None
    weekend_dows = {5, 6}  # Saturday=5, Sunday=6
    
    for i in range(1, days + 1):
        pred_date = last_date + timedelta(days=i)
        day_of_week = pred_date.weekday()
        day_of_month = pred_date.day

        # DOW factor - blend learned with default, protect weekend from being too low
        default_mult = default_dow.get(day_of_week, 1.0)
        
        if learned_dow and day_of_week in learned_dow:
            learned_factor = learned_dow[day_of_week]
            is_weekend = day_of_week in weekend_dows
            
            # If weekend and learned is lower than default, blend toward default
            if is_weekend and learned_factor < default_mult:
                blend_toward_default = 0.7 - (variation_scale * 0.4)  # 0.3-0.7
                dow_factor = learned_factor * (1 - blend_toward_default) + default_mult * blend_toward_default
            else:
                # Normal blending
                dow_factor = learned_factor * variation_scale + default_mult * (1 - variation_scale)
        else:
            dow_factor = default_mult

        # Payday factor (scaled)
        if day_of_month >= 25 or day_of_month <= 5:
            payday_factor = 1.0 + (0.08 * variation_scale)
        elif day_of_month >= 12 and day_of_month <= 18:
            payday_factor = 1.0 - (0.05 * variation_scale)
        else:
            payday_factor = 1.0

        # Apply trend (scaled by sensitivity)
        trend_adjustment = trend * i * trend_sensitivity
        base_pred = max(1, baseline + trend_adjustment)
        
        # Calculate prediction
        predicted = base_pred * dow_factor * payday_factor
        
        # Small variation (scaled)
        date_seed = (day_of_month * 3 + pred_date.month * 7 + day_of_week * 2) % 100
        max_var = 0.05 * variation_scale
        variation = 1.0 + ((date_seed - 50) / 100) * max_var
        predicted = predicted * variation
        
        # Smooth transitions (stricter for less data)
        max_change = 0.15 + (0.15 * variation_scale)
        if prev_pred is not None and prev_pred > 0:
            change_ratio = predicted / prev_pred
            if change_ratio > (1 + max_change):
                predicted = prev_pred * (1 + max_change * 0.8)
            elif change_ratio < (1 - max_change):
                predicted = prev_pred * (1 - max_change * 0.8)

        # Integer output
        predicted = int(max(1, round(predicted)))
        lower = int(max(0, round(predicted - std)))
        upper = int(round(predicted + std))
        
        prev_pred = predicted

        predictions.append({
            'date': pred_date.strftime('%Y-%m-%d'),
            'predicted_quantity': predicted,
            'lower_bound': lower,
            'upper_bound': upper,
            'confidence': confidence
        })

    return predictions


def _calculate_momentum(df) -> Dict:
    """Calculate momentum from sales data"""
    if len(df) < 7:
        return {'combined': 1.0, 'status': 'STABLE'}

    recent_7 = df.tail(7)['quantity'].mean()
    previous_7 = df.tail(14).head(7)['quantity'].mean() if len(df) >= 14 else recent_7

    ratio = recent_7 / previous_7 if previous_7 > 0 else 1.0

    if ratio > 1.15:
        status = 'TRENDING_UP'
    elif ratio > 1.05:
        status = 'GROWING'
    elif ratio < 0.85:
        status = 'DECLINING'
    elif ratio < 0.95:
        status = 'FALLING'
    else:
        status = 'STABLE'

    return {
        'combined': round(ratio, 3),
        'status': status
    }


def _detect_burst(df) -> Dict:
    """Detect burst/anomaly in sales data"""
    if len(df) < 5:
        return {'score': 0, 'level': 'NORMAL', 'type': 'NORMAL'}

    quantities = df['quantity'].values
    baseline = quantities[:-1]
    latest = quantities[-1]

    mean = baseline.mean() if len(baseline) > 0 else 0
    std = baseline.std() if len(baseline) > 1 else 1
    std = max(std, 0.1)  # Prevent division by zero

    z_score = (latest - mean) / std

    if z_score > 3:
        level = 'CRITICAL'
    elif z_score > 2:
        level = 'HIGH'
    elif z_score > 1.5:
        level = 'MEDIUM'
    else:
        level = 'NORMAL'

    # Determine type
    burst_type = 'NORMAL'
    if level != 'NORMAL':
        last_date = df['date'].max()
        if hasattr(last_date, 'weekday'):
            day = last_date.weekday()
            burst_type = 'SEASONAL' if day in [5, 6] else 'SPIKE'

    return {
        'score': round(float(z_score), 2),
        'level': level,
        'type': burst_type
    }


@app.post("/api/ml/train")
def train_model(request: TrainRequest):
    """Train new model"""
    try:
        # Sanitize product ID
        request.product_id = sanitize_product_id(request.product_id)

        # Validate sales_data is not empty
        if not request.sales_data or len(request.sales_data) == 0:
            raise HTTPException(
                status_code=400,
                detail="sales_data cannot be empty"
            )

        # Validate minimum data size
        if len(request.sales_data) < 7:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data: {len(request.sales_data)} rows (minimum 7 required for training)"
            )

        # Validate data structure (check first 3 rows for performance)
        for i, row in enumerate(request.sales_data[:3]):
            if not isinstance(row, dict):
                raise HTTPException(
                    status_code=400,
                    detail=f"Row {i} must be a dictionary"
                )
            if 'date' not in row or 'quantity' not in row:
                raise HTTPException(
                    status_code=400,
                    detail=f"Row {i} missing required fields ('date', 'quantity')"
                )

        result = forecaster.train(request.sales_data, request.product_id)

        os.makedirs(os.path.join(BASE_DIR, 'models'), exist_ok=True)
        model_path = os.path.join(BASE_DIR, "models", f"xgboost_{request.product_id}.pkl")
        forecaster.save_model(request.product_id, model_path)

        return {
            'success': True,
            'trained': True,
            'model': result
        }

    except HTTPException:
        raise
    except ValueError as e:
        # Training validation errors
        logger.error(f"Training validation error: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Invalid data: {str(e)}")
    except Exception as e:
        logger.error(f"Training error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@app.post("/api/ml/forecast-hybrid")
def hybrid_forecast(request: HybridForecastRequest):
    """Ensemble forecast with realtime data"""
    try:
        # Sanitize product ID
        request.product_id = sanitize_product_id(request.product_id)

        result = ensemble.predict(
            product_id=request.product_id,
            realtime_data=request.realtime_data,
            days=request.days
        )
        if not result.get('success'):
            raise HTTPException(status_code=404, detail=result.get('error', 'Hybrid forecast failed'))
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Hybrid forecast error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/inventory/optimize")
def optimize_inventory(request: dict):
    """
    Inventory optimization endpoint
    v2.0: Supports service_level parameter (low/medium/high/critical)
    """
    try:
        product_id = request.get('product_id')
        service_level = request.get('service_level', 'medium')

        if not product_id:
            raise HTTPException(status_code=400, detail="product_id is required")

        # Sanitize product ID
        product_id = sanitize_product_id(product_id)

        # Validate and convert current_stock
        try:
            current_stock = float(request.get('current_stock', 0))
            if current_stock < 0:
                raise HTTPException(status_code=400, detail="current_stock cannot be negative")
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="current_stock must be a number")

        # Validate and convert lead_time_days
        try:
            lead_time_days = int(request.get('lead_time_days', 3))
            if lead_time_days < 1 or lead_time_days > 30:
                raise HTTPException(status_code=400, detail="lead_time_days must be between 1 and 30")
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="lead_time_days must be an integer")

        model_candidates = [
            os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{product_id}.pkl"),
            os.path.join(BASE_DIR, "models", f"xgboost_{product_id}.pkl"),
            os.path.join(BASE_DIR, "models", "artifacts", f"xgboost_{product_id}.pkl"),
        ]

        model_path = None
        for path in model_candidates:
            if os.path.exists(path):
                model_path = path
                break

        if not model_path:
            raise HTTPException(status_code=404, detail=f"Model not found for product: {product_id}")

        brain = HybridBrain(product_id)
        if not brain.load_model(product_id, model_path):
            raise HTTPException(status_code=500, detail="Failed to load model")

        predictions = brain.predict_next_days(14)
        quantities = [p.get('predicted_quantity', 0) for p in predictions]

        optimizer = InventoryOptimizer()
        inventory_result = optimizer.optimize_inventory(
            quantities[:7],
            current_stock,
            lead_time_days,
            service_level
        )

        return {
            'success': True,
            'product_id': product_id,
            'inventory': inventory_result,
            'forecast_7days': predictions[:7],
            'generated_at': datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Inventory optimization error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/profit/forecast")
def forecast_profit(request: dict):
    """
    Profit forecasting endpoint
    v2.0: Auto-allocates fixed costs across portfolio
    """
    try:
        product_id = request.get('product_id')

        if not product_id:
            raise HTTPException(status_code=400, detail="product_id is required")

        # Sanitize product ID
        product_id = sanitize_product_id(product_id)

        # Validate numeric inputs
        try:
            cost_per_unit = float(request.get('cost_per_unit', 0))
            price_per_unit = float(request.get('price_per_unit', 0))
            fixed_costs_weekly = float(request.get('fixed_costs_weekly', 0))
            days = int(request.get('days', 7))

            if cost_per_unit < 0:
                raise HTTPException(status_code=400, detail="cost_per_unit cannot be negative")
            if price_per_unit <= 0:
                raise HTTPException(status_code=400, detail="price_per_unit must be positive")
            if fixed_costs_weekly < 0:
                raise HTTPException(status_code=400, detail="fixed_costs_weekly cannot be negative")
            if days < 1 or days > 30:
                raise HTTPException(status_code=400, detail="days must be between 1 and 30")
        except (ValueError, TypeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid numeric parameter: {str(e)}")

        model_candidates = [
            os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{product_id}.pkl"),
            os.path.join(BASE_DIR, "models", f"xgboost_{product_id}.pkl"),
            os.path.join(BASE_DIR, "models", "artifacts", f"xgboost_{product_id}.pkl"),
        ]

        model_path = None
        for path in model_candidates:
            if os.path.exists(path):
                model_path = path
                break

        if not model_path:
            raise HTTPException(status_code=404, detail=f"Model not found for product: {product_id}")

        brain = HybridBrain(product_id)
        if not brain.load_model(product_id, model_path):
            raise HTTPException(status_code=500, detail="Failed to load model")

        predictions = brain.predict_next_days(days)

        analyzer = ProfitAnalyzer()
        profit_result = analyzer.forecast_profit(
            predictions,
            cost_per_unit,
            price_per_unit,
            fixed_costs_weekly
        )

        return {
            'success': True,
            'product_id': product_id,
            'profit_analysis': profit_result,
            'generated_at': datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profit forecast error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ml/report/weekly")
def get_weekly_report(request: Request, product_id: Optional[str] = None):
    """Generate weekly report for products"""
    try:
        if product_id:
            products = [product_id]
        else:
            products = get_all_product_ids_from_models()

        if not products:
            return {
                'success': True,
                'message': 'No trained models found',
                'report': None
            }

        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)

        period_info = {
            'start': start_date.strftime('%Y-%m-%d'),
            'end': end_date.strftime('%Y-%m-%d'),
            'days': 7
        }
        products_data: List[Dict] = []

        for pid in products:
            try:
                model_path = None
                for candidate in [
                    os.path.join(BASE_DIR, "training", "models_output", f"xgboost_{pid}.pkl"),
                    os.path.join(BASE_DIR, "models", f"xgboost_{pid}.pkl"),
                    os.path.join(BASE_DIR, "models", "artifacts", f"xgboost_{pid}.pkl")
                ]:
                    if os.path.exists(candidate):
                        model_path = candidate
                        break

                if not model_path:
                    continue

                brain = HybridBrain(pid)
                if not brain.load_model(pid, model_path):
                    continue

                predictions = brain.predict_next_days(7)
                next_week_total = sum(p['predicted_quantity'] for p in predictions)

                momentum_data = brain.physics_metrics.get('momentum', {})
                status = momentum_data.get('status', 'STABLE')
                combined_momentum = momentum_data.get('combined', 0)

                burst_data = brain.physics_metrics.get('burst', {})
                recommendation = brain.get_recommendation()

                product_report = {
                    'product_id': pid,
                    'next_week_forecast': round(next_week_total, 1),
                    'avg_daily_forecast': round(next_week_total / 7, 1),
                    'momentum': {
                        'status': status,
                        'percentage': round(combined_momentum * 100, 1),
                        'trend': 'UP' if combined_momentum > 0.05 else 'DOWN' if combined_momentum < -0.05 else 'FLAT'
                    },
                    'burst': {
                        'level': burst_data.get('level', 'NORMAL'),
                        'score': round(burst_data.get('burst_score', 0), 2)
                    },
                    'recommendation': {
                        'type': recommendation.get('type'),
                        'priority': recommendation.get('priority'),
                        'message': recommendation.get('message')
                    },
                    'predictions': predictions
                }

                products_data.append(product_report)

            except Exception as e:
                logger.warning(f"Failed to generate report for {pid}: {e}")
                continue

        ranking_strategy = request.query_params.get('ranking_strategy', 'balanced')

        # Safely parse top_n parameter
        try:
            top_n = int(request.query_params.get('top_n', 3))
            top_n = max(1, min(top_n, 20))  # Clamp to [1, 20]
        except (ValueError, TypeError):
            logger.warning(f"Invalid top_n parameter, using default 3")
            top_n = 3

        include_insights = request.query_params.get('include_insights', 'true').lower() == 'true'

        ranked_products = report_ranker.rank_products(products=products_data, strategy=ranking_strategy)
        needs_attention = report_ranker.identify_needs_attention(products=ranked_products, top_n=top_n)
        top_performers = ranked_products[:top_n]

        insights = None
        if include_insights:
            insights = report_ranker.generate_insights(
                products=ranked_products,
                top_performers=top_performers,
                needs_attention=needs_attention
            )

        summary = {
            "total_products": len(ranked_products),
            "trending_up": sum(1 for p in ranked_products if p['momentum']['status'] == 'TRENDING_UP'),
            "growing": sum(1 for p in ranked_products if p['momentum']['status'] == 'GROWING'),
            "stable": sum(1 for p in ranked_products if p['momentum']['status'] == 'STABLE'),
            "falling": sum(1 for p in ranked_products if p['momentum']['status'] == 'FALLING'),
            "declining": sum(1 for p in ranked_products if p['momentum']['status'] == 'DECLINING')
        }

        report = {
            'period': period_info,
            'ranking_strategy': ranking_strategy,
            'summary': summary,
            'top_performers': top_performers,
            'needs_attention': needs_attention,
            'insights': insights,
            'products': ranked_products if product_id else None
        }

        return {
            'success': True,
            'report': report,
            'generated_at': datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Weekly report error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server with BASE_DIR: {BASE_DIR}")
    # Use platform-provided PORT when available (recommended for deployment platforms).
    # For Hugging Face Spaces, the default port is commonly 7860.
    # For local development, default to 8000 (matches repo README).
    host = os.getenv("HOST", "0.0.0.0")

    port_env = os.getenv("PORT")
    if port_env:
        port = int(port_env)
    else:
        # Heuristic: running on Hugging Face Spaces (PORT not always injected in all setups)
        is_hf_spaces = any(
            os.getenv(k)
            for k in [
                "SPACE_ID",
                "SPACE_REPO_NAME",
                "SPACE_AUTHOR_NAME",
                "HF_SPACE",
                "SYSTEM",  # often set to "spaces" on HF
            ]
        ) or (os.getenv("SYSTEM", "").lower() == "spaces")

        port = 7860 if is_hf_spaces else 8000

    uvicorn.run(app, host=host, port=port)