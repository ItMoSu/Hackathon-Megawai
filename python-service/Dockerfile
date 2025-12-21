# Lightweight Python base; 3.11 works with current deps
FROM python:3.11-slim

WORKDIR /app

# Environment tweaks
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps
# PERUBAHAN DISINI: Mengganti 'openjdk-17-jre-headless' menjadi 'default-jre-headless'
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      build-essential \
      default-jre-headless \
      libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copy source
COPY . /app

# Optional: relax permissions
RUN chmod -R 755 /app

# Default command
CMD ["python", "main.py"]