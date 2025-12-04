# Architecture Documentation

## Design Principles

### SOLID Principles

**Single Responsibility**
- Each class has one reason to change
- `ColumnDetector` only detects columns
- `DataCleaner` only cleans data
- `SalesDataValidator` only validates

**Open/Closed**
- Open for extension via new processors
- Closed for modification of base classes
- Add new file types without changing core

**Liskov Substitution**
- All processors implement `IFileProcessor`
- Can swap processors without breaking code

**Interface Segregation**
- Small, focused interfaces
- Clients depend only on methods they use

**Dependency Inversion**
- Services depend on abstractions (interfaces)
- Not on concrete implementations

### Design Patterns

**Strategy Pattern**
```python
# Different strategies for different files
class CSVProcessor(BaseFileProcessor): ...
class ExcelProcessor(BaseFileProcessor): ...
```

**Factory Pattern**
```python
# Automatic selection of processor
processor = ProcessorFactory.get_processor(filepath)
```

**Template Method**
```python
# Base defines workflow, subclasses fill details
class BaseFileProcessor:
    def process(self):
        df = self.read_file()  # Override this
        return self.standardize()  # Common logic
```

**Observer Pattern**
```python
# Progress notifications
observer.on_file_start(...)
observer.on_file_complete(...)
```

**Facade Pattern**
```python
# Simple API hides complexity
service = PreprocessingService(config)
service.process_all()  # Does everything
```

**Adapter Pattern**
```python
# Adapt existing forecaster to interface
class XGBoostModelTrainer(IModelTrainer):
    def train(...):
        return forecaster.train(...)  # Adapt
```

**Singleton Pattern**
```python
# Single logger instance
logger = Logger()  # Always same instance
```

## Component Diagram
```
┌─────────────────────────────────────────────┐
│            CLI Scripts (UI)                 │
│  preprocess.py  train.py  pipeline.py       │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│           Services (Facade)                 │
│  PreprocessingService  TrainingService      │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼─────────┐  ┌──────▼──────────┐
│   Processors    │  │    Utilities    │
│  (Strategy)     │  │  (SRP Classes)  │
│                 │  │                 │
│ • CSVProcessor  │  │ • Validator     │
│ • ExcelProc     │  │ • Detector      │
│ • PDFProc       │  │ • Cleaner       │
│ • DOCXProc      │  │ • Logger        │
│ • TextProc      │  │                 │
└─────────────────┘  └─────────────────┘
        │                   │
        └─────────┬─────────┘
                  │
    ┌─────────────▼──────────────┐
    │   Core (Interfaces)        │
    │  • IFileProcessor          │
    │  • IDataValidator          │
    │  • IColumnDetector         │
    │  • IModelTrainer           │
    │  • IProgressObserver       │
    └────────────────────────────┘
```

## Data Flow
```
1. User drops files → datasets/

2. PreprocessingService:
   ├─ Discover files
   ├─ ProcessorFactory selects processor
   ├─ Processor reads & cleans
   ├─ Validator checks quality
   └─ Save to preprocessed/

3. TrainingService:
   ├─ Load preprocessed CSVs
   ├─ XGBoostModelTrainer trains
   ├─ Validator checks data
   └─ Save models to models_output/

4. Output: Trained models ready for API
```

## Extension Points

### Add New File Format
1. Create `NewFormatProcessor(BaseFileProcessor)`
2. Implement `read_file()` method
3. Add to `ProcessorFactory._processors`

### Add New Validation
1. Implement `IDataValidator`
2. Use in services as needed

### Change ML Model
1. Implement `IModelTrainer`
2. Pass to `TrainingService`

## Testing Strategy

- **Unit Tests**: Test each component in isolation
- **Integration Tests**: Test service workflows
- **End-to-End Tests**: Test complete pipeline

## Performance Considerations

- **Lazy Loading**: Processors created on-demand
- **Streaming**: Large files processed in chunks
- **Validation**: Early validation prevents wasted processing
- **Logging**: Async logging to avoid blocking
