import express from 'express';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import Papa from 'papaparse';

const router = express.Router();

const ML_API_URL = (process.env.ML_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// Simple Indonesian-to-English translation map for fallback
const idToEnMap: Record<string, string> = {
  // Positif
  "bagus": "good", "baik": "good", "terbaik": "excellent", "mantap": "great",
  "suka": "love", "cinta": "love", "puas": "satisfied", "senang": "happy",
  "ramah": "friendly", "nyaman": "comfortable", "recommended": "recommended",
  "rekomendasi": "recommended", "rekomen": "recommended", "enak": "delicious",
  "lezat": "delicious", "nikmat": "delicious", "segar": "fresh", "murah": "cheap",
  "terjangkau": "affordable", "bersih": "clean", "cepat": "fast", "keren": "cool",
  "hebat": "great", "favorit": "favorite", "sempurna": "perfect", "mantul": "great",
  "gokil": "amazing", "kece": "cool", "jos": "great", "top": "top", "asik": "fun",
  "worthit": "worth", "worth": "worth",
  // Negatif
  "buruk": "bad", "jelek": "bad", "parah": "awful", "terburuk": "worst",
  "mengecewakan": "disappointing", "kecewa": "disappointed", "benci": "hate",
  "payah": "terrible", "sampah": "trash", "lambat": "slow", "lemot": "slow",
  "mahal": "expensive", "kotor": "dirty", "jorok": "dirty", "bau": "smelly",
  "palsu": "fake", "bohong": "lie", "tipu": "scam", "rusak": "broken",
  "zonk": "bad", "gagal": "failed", "kapok": "regret", "nyesel": "regret",
  "rugi": "loss", "menyesal": "regret", "hancur": "ruined", "busuk": "rotten",
  // Netral
  "biasa": "ordinary", "standar": "standard", "lumayan": "okay",
  // Negasi
  "tidak": "not", "nggak": "not", "enggak": "not", "gak": "not", "ga": "not", 
  "ngga": "not", "tak": "not",
  // Intensifier
  "sangat": "very", "banget": "really", "sekali": "very", "bgt": "really",
};

// Translate Indonesian text to English for better analysis
const translateIdToEn = (text: string): string => {
  let lower = (text || '').toLowerCase();
  
  // Phrase-level replacements
  const phrases: [string, string][] = [
    ["bagus banget", "very good"], ["enak banget", "very delicious"],
    ["mantap banget", "very great"], ["suka banget", "really love"],
    ["buruk banget", "very bad"], ["jelek banget", "very bad"],
    ["kecewa banget", "very disappointed"], ["mahal banget", "very expensive"],
    ["kotor banget", "very dirty"], ["lambat banget", "very slow"],
    ["recommended banget", "highly recommended"], ["puas banget", "very satisfied"],
    ["biasa saja", "average"], ["biasa aja", "average"],
    ["tidak enak", "not tasty"], ["ga enak", "not tasty"], ["gak enak", "not tasty"],
    ["tidak bagus", "not good"], ["ga bagus", "not good"], ["gak bagus", "not good"],
    ["wajib coba", "must try"], ["harus coba", "must try"],
  ];
  
  for (const [src, dst] of phrases) {
    if (lower.includes(src)) {
      lower = lower.replace(new RegExp(src, 'g'), dst);
    }
  }
  
  // Word-level translation
  const tokens = lower.split(/\s+/);
  const translated = tokens.map(tok => idToEnMap[tok] || tok);
  return translated.join(' ');
};

// Fallback simple heuristic if ML service unreachable
// Enhanced with Indonesian support
const simpleSentiment = (text: string) => {
  const originalLower = (text || '').toLowerCase();
  
  // Translate if Indonesian
  const t = translateIdToEn(text);
  
  // English positive words
  const positives = [
    "good", "great", "amazing", "love", "nice", "excellent", "best", "wonderful",
    "awesome", "affordable", "happy", "delicious", "friendly", "comfortable",
    "recommended", "fresh", "clean", "fast", "cool", "perfect", "satisfied",
    "worth", "favorite", "beautiful", "fantastic"
  ];
  
  // English negative words
  const negatives = [
    "bad", "terrible", "worst", "awful", "poor", "hate", "sad", "angry",
    "dirty", "expensive", "disappointing", "disappointed", "slow", "smelly",
    "fake", "scam", "broken", "ruined", "trash", "regret", "failed", "rotten"
  ];
  
  // Indonesian positive words (direct check on original)
  const positivesId = [
    "bagus", "baik", "enak", "mantap", "suka", "cinta", "puas", "senang",
    "ramah", "nyaman", "recommended", "rekomendasi", "rekomen", "lezat",
    "nikmat", "segar", "murah", "bersih", "cepat", "keren", "hebat",
    "favorit", "sempurna", "gokil", "kece", "jos", "top", "worthit", "mantul"
  ];
  
  // Indonesian negative words (direct check on original)
  const negativesId = [
    "buruk", "jelek", "parah", "terburuk", "mengecewakan", "kecewa", "benci",
    "payah", "sampah", "lambat", "lemot", "mahal", "kotor", "jorok", "bau",
    "palsu", "bohong", "tipu", "rusak", "zonk", "gagal", "kapok", "nyesel",
    "rugi", "menyesal", "hancur", "busuk"
  ];
  
  // Indonesian neutral words
  const neutralId = ["biasa", "standar", "lumayan", "cukup"];
  
  let score = 0;
  
  // Check English (from translated text)
  positives.forEach((w) => { if (t.includes(w)) score += 1; });
  negatives.forEach((w) => { if (t.includes(w)) score -= 1; });
  
  // Check Indonesian (from original text)
  positivesId.forEach((w) => { if (originalLower.includes(w)) score += 1; });
  negativesId.forEach((w) => { if (originalLower.includes(w)) score -= 1; });
  
  // Check for negation patterns
  const negationPatterns = [
    /tidak\s+\w*bagus/i, /tidak\s+\w*enak/i, /tidak\s+\w*puas/i,
    /ga\s+\w*bagus/i, /ga\s+\w*enak/i, /ga\s+\w*puas/i,
    /gak\s+\w*bagus/i, /gak\s+\w*enak/i, /gak\s+\w*puas/i,
    /nggak\s+\w*bagus/i, /nggak\s+\w*enak/i,
    /kurang\s+\w*bagus/i, /kurang\s+\w*enak/i, /kurang\s+\w*puas/i,
  ];
  negationPatterns.forEach((pattern) => {
    if (pattern.test(originalLower)) score -= 2;
  });
  
  // Check for neutral indicators
  const isNeutral = neutralId.some(w => originalLower.includes(w)) && Math.abs(score) < 2;
  
  let sentiment = "Neutral";
  const absScore = Math.abs(score);
  if (score > 0) sentiment = "Positive";
  else if (score < 0) sentiment = "Negative";
  else if (isNeutral) sentiment = "Neutral";
  
  const emoji = sentiment === "Positive" ? "😊" : sentiment === "Negative" ? "😞" : "😐";
  const confidence = sentiment === "Neutral"
    ? 50
    : Math.min(95, 55 + absScore * 10); // make confidence vary with score
  return { sentiment, confidence, emoji };
};

// Multer setup for CSV upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const nameOk = file.originalname.toLowerCase().endsWith(".csv");
    const typeOk = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/octet-stream",
      "application/csv",
      "text/plain",
    ].includes(file.mimetype);
    if (nameOk || typeOk) return cb(null, true);
    cb(new Error("Only CSV files are allowed"));
  },
});

router.post('/analyze-text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const response = await axios.post(
      `${ML_API_URL}/api/sentiment/analyze-text`,
      { text },
      { timeout: 20000 }
    );
    return res.json(response.data);
  } catch (error: any) {
    // Fallback heuristic so user still gets result
    const fallback = simpleSentiment(req.body?.text || "");
    const upstreamMsg =
      error?.response?.data?.error ||
      error?.response?.data?.detail ||
      error?.message ||
      'Model utama tidak tersedia, menggunakan fallback heuristik.';
    return res.status(200).json({ success: true, result: fallback, warning: upstreamMsg });
  }
});

// Helper to wrap multer and return JSON on error (to avoid HTML error pages)
const uploadSingleCsv = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
  });
};

router.post('/analyze-file', uploadSingleCsv, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname || 'upload.csv',
      contentType: file.mimetype || 'text/csv'
    });

    const response = await axios.post(`${ML_API_URL}/api/sentiment/analyze-file`, formData, {
      headers: formData.getHeaders(),
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return res.json(response.data);
  } catch (error: any) {
    // Fallback heuristic per-row
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'CSV file is required' });
      // Re-read buffer here
      const parsed = Papa.parse(file.buffer.toString('utf-8'), {
        header: true,
        skipEmptyLines: true,
      });
      const rows = Array.isArray(parsed.data) ? parsed.data : [];

      let positive = 0, negative = 0, neutral = 0;
      const results = rows.map((row: any) => {
        const text = row?.Review || row?.review || row?.text || row?.clean_review || "";
        const r = simpleSentiment(text);
        if (r.sentiment.toLowerCase() === "positive") positive++;
        else if (r.sentiment.toLowerCase() === "negative") negative++;
        else neutral++;
        return { review: text, sentiment: r.sentiment, confidence: r.confidence, emoji: r.emoji };
      });

      const total = Math.max(1, results.length);
      const summary = {
        positive,
        negative,
        neutral,
        positive_pct: Math.round((positive / total) * 10000) / 100,
        negative_pct: Math.round((negative / total) * 10000) / 100,
        neutral_pct: Math.round((neutral / total) * 10000) / 100,
        total,
      };

      const upstreamMsg =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        (typeof error?.message === 'string' ? error.message : '') ||
        'Model utama tidak tersedia, menggunakan fallback heuristik.';

      return res.status(200).json({ success: true, summary, results, warning: upstreamMsg });
    } catch (fallbackErr: any) {
      const status = error?.response?.status || 500;
      const upstreamMsg =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        (typeof error?.message === 'string' ? error.message : '') ||
        'Failed to analyze file';
      return res.status(status).json({ error: upstreamMsg });
    }
  }
});

export default router;

