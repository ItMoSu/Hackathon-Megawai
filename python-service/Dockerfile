# Lightweight Python base; 3.11 works with current deps
FROM python:3.11-slim

WORKDIR /app

# Environment tweaks
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NLTK_DATA=/app/nltk_data

# System deps
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      build-essential \
      default-jre-headless \
      libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt /app/requirements.txt

# Install Python deps - ensure nltk is installed
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt && \
    pip install --no-cache-dir nltk>=3.8.1

# Download NLTK data after nltk is installed
RUN python -c "import nltk; nltk.download('punkt', download_dir='/app/nltk_data'); nltk.download('wordnet', download_dir='/app/nltk_data'); nltk.download('stopwords', download_dir='/app/nltk_data')"

# Copy source
COPY . /app

# Optional: relax permissions
RUN chmod -R 755 /app

# Default command - use PORT env var for Hugging Face compatibility
CMD ["python", "main.py"]