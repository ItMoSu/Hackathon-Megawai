# 🎯 AI Market Pulse - ML Training Pipeline

Production-grade machine learning training system with clean architecture.

## 🏗️ Architecture

Built with **SOLID principles** and **design patterns**:

- **Strategy Pattern**: Multiple file processors (CSV, Excel, PDF, DOCX, TXT)
- **Factory Pattern**: Automatic processor selection
- **Template Method**: Base preprocessing workflow
- **Observer Pattern**: Progress tracking and logging
- **Facade Pattern**: High-level service APIs
- **Adapter Pattern**: XGBoost model integration

## 📁 Project Structure
```
training/
├── datasets/              # 📥 DROP YOUR FILES HERE
│   ├── sales_data.csv
│   ├── report.xlsx
│   └── data.pdf
├── preprocessed/          # 🔄 AUTO-GENERATED (cleaned data)
├── models_output/         # 🎯 AUTO-GENERATED (trained models)
├── logs/                  # 📝 Execution logs
├── core/                  # 🏛️ Interfaces & models
│   ├── interfaces.py      # Abstract base classes
│   ├── models.py          # Data classes
│   └── exceptions.py      # Custom exceptions
├── processors/            # 📄 File processors
│   ├── base.py            # Base processor (template method)
│   ├── csv_processor.py
│   ├── excel_processor.py
│   ├── pdf_processor.py
│   ├── docx_processor.py
│   └── text_processor.py
├── services/              # 🎛️ Business logic
│   ├── preprocessing_service.py
│   └── training_service.py
├── utils/                 # 🔧 Utilities
│   ├── logger.py          # Singleton logger
│   └── validators.py      # Data validation
├── config.py              # ⚙️ Configuration
├── preprocess.py          # 🔄 CLI: Preprocessing
├── train.py               # 🎯 CLI: Training
└── pipeline.py            # 🚀 CLI: Complete pipeline
```

## 🛠 Requirements

- Install project deps (includes PDF/DOCX/Excel support):  
  from `python-service/`: `pip install -r requirements.txt`  
  (from `python-service/training/`: `pip install -r ../requirements.txt`)

## 🚀 Usage

Run from `python-service/training`:

```bash
# 1) Preprocess raw files dropped in datasets/
python preprocess.py

# 2) Train models from preprocessed data
python train.py

# Or run everything in one go
python pipeline.py
```

## 📦 Output

### Preprocessed Data
- Location: `preprocessed/`
- Format: `{original_name}_{product}_cleaned.csv`
- Columns: `date`, `quantity`
- Sorted by date, outliers removed

### Trained Models
- Location: `models_output/`
- Format: `xgboost_{product_id}.pkl`
- Includes: P10, P50, P90 models
- Metadata: `xgboost_{product_id}_metadata.json`

## 🎯 Next Steps

After training, models are ready for:
1. Deployment to production API
2. Forecasting via `forecaster.predict()`
3. Integration with frontend dashboard

## 🤝 Contributing

This codebase follows:
- **SOLID Principles**: Single Responsibility, Open/Closed, etc.
- **Clean Architecture**: Separation of concerns
- **Design Patterns**: Strategy, Factory, Observer, etc.
- **Type Hints**: Full type annotations
- **Documentation**: Comprehensive docstrings

## 📄 License

MIT License - See LICENSE file
