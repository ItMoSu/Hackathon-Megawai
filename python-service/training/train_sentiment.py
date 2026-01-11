"""
Training script for sentiment classification using TF-IDF + XGBoost (binary pos/neg).
Dataset: training/datasets/tf-idf_training.csv
Labels:
  - rating >= 4 -> positive (1)
  - rating <= 2 -> negative (0)
  - rating == 3 -> dropped
Outputs:
  - models/tfidf_vectorizer.pkl
  - models/xgboost_sentiment.pkl
Metrics printed: accuracy + classification report + F1 (macro/weighted implicit in report).
"""

import os
import re
import logging
import pandas as pd
import numpy as np
import pickle
from typing import Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    mean_absolute_error,
)
from xgboost import XGBClassifier
import nltk
from nltk.stem import PorterStemmer
from nltk.corpus import stopwords

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("train_sentiment")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_PATH = os.path.join(BASE_DIR, "training", "datasets", "tf-idf_training.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")


# Ensure nltk resources
for resource in ["stopwords", "punkt"]:
    try:
        nltk.data.find(f"corpora/{resource}")
    except LookupError:
        nltk.download(resource, quiet=True)

STOPWORDS = set(stopwords.words("english"))
STEMMER = PorterStemmer()


def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"[^a-z\s]", " ", text)
    words = text.split()
    cleaned_words = [STEMMER.stem(w) for w in words if w and w not in STOPWORDS]
    return " ".join(cleaned_words).strip()


def load_dataset(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dataset not found at {path}")
    df = pd.read_csv(path)
    if "Review" not in df.columns or "Rating" not in df.columns:
        raise ValueError("Dataset must contain columns 'Review' and 'Rating'")
    df = df[["Review", "Rating"]].dropna()

    # Safely parse rating to float, drop invalids
    df["rating_float"] = pd.to_numeric(df["Rating"], errors="coerce")
    df = df.dropna(subset=["rating_float"])

    # Drop neutral (exact 3.0) and keep binary labels
    df = df[df["rating_float"] != 3.0]
    df["label"] = df["rating_float"].apply(lambda x: 1 if x > 3 else 0)
    df["clean_review"] = df["Review"].apply(clean_text)
    df = df[df["clean_review"].str.len() > 0]
    return df


def top_terms(df: pd.DataFrame, n: int = 10):
    all_text = " ".join(df["clean_review"].tolist()).split()
    freq: Dict[str, int] = {}
    for w in all_text:
        freq[w] = freq.get(w, 0) + 1
    sorted_items = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:n]
    total = max(1, len(all_text))
    return [
        {"word": w, "count": c, "pct": round(c / total * 100, 2)}
        for w, c in sorted_items
    ]


def vectorize_full(df: pd.DataFrame) -> Tuple:
    vectorizer = TfidfVectorizer(
        max_features=2000,
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.95,
    )
    X_vec = vectorizer.fit_transform(df["clean_review"])
    y = df["label"].values
    return vectorizer, X_vec, y


def train_model(X_train, y_train):
    model = XGBClassifier(
        use_label_encoder=False,
        eval_metric="logloss",
        learning_rate=0.2,
        max_depth=8,
        n_estimators=400,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
    )
    model.fit(X_train, y_train)
    return model


def evaluate_train_only(model, X_train, y_train):
    preds_train = model.predict(X_train)

    acc_train = accuracy_score(y_train, preds_train)
    f1_train = f1_score(y_train, preds_train, average="macro", zero_division=0)
    mae_train = mean_absolute_error(y_train, preds_train)

    overfit_ratio = 1.0  # train/train baseline

    report = classification_report(y_train, preds_train, digits=4)

    return {
        "acc_train": acc_train,
        "f1_train": f1_train,
        "mae_train": mae_train,
        "overfit_ratio": overfit_ratio,
        "report": report,
    }


def save_artifacts(vectorizer, model):
    os.makedirs(MODELS_DIR, exist_ok=True)
    vec_path = os.path.join(MODELS_DIR, "tfidf_vectorizer.pkl")
    model_path = os.path.join(MODELS_DIR, "xgboost_sentiment.pkl")
    with open(vec_path, "wb") as f:
        pickle.dump(vectorizer, f)
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    logger.info(f"Saved vectorizer to {vec_path}")
    logger.info(f"Saved model to {model_path}")


def main():
    logger.info("Loading dataset...")
    df = load_dataset(DATA_PATH)
    logger.info(f"Dataset loaded: {len(df)} rows")
    logger.info(f"Label distribution: {df['label'].value_counts().to_dict()}")

    # Top terms
    top10 = top_terms(df, n=10)
    logger.info("Top 10 terms (cleaned): " + str(top10))

    vectorizer, X_vec, y = vectorize_full(df)
    logger.info("Training XGBoost classifier...")
    model = train_model(X_vec, y)

    logger.info("Evaluating...")
    metrics = evaluate_train_only(model, X_vec, y)
    logger.info(f"Accuracy (train): {metrics['acc_train']:.4f}")
    logger.info(f"F1 (macro, train): {metrics['f1_train']:.4f}")
    logger.info(f"MAE (train): {metrics['mae_train']:.4f}")
    logger.info(f"Overfit ratio (train/train): {metrics['overfit_ratio']:.4f}")
    logger.info("Classification report:\n" + metrics["report"])

    save_artifacts(vectorizer, model)

    print("\n=== HASIL TRAINING ===")
    print(f"Akurasi (train): {metrics['acc_train'] * 100:.2f}%")
    print(f"F1 (macro, train): {metrics['f1_train']:.4f}")
    print(f"MAE (train): {metrics['mae_train']:.4f}")
    print(f"Overfit ratio (train/train): {metrics['overfit_ratio']:.4f}")
    print("\nLaporan Detail:")
    print(metrics["report"])
    print("\nTop 10 kata terbanyak (cleaned):")
    for item in top10:
        print(f"- {item['word']}: {item['count']}x ({item['pct']}%)")


if __name__ == "__main__":
    main()

