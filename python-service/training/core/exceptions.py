'''
Custom Exceptions (Clear error handling)
'''


class PreprocessingError(Exception):
    '''Base exception for preprocessing errors'''
    pass


class FileProcessingError(PreprocessingError):
    '''Error during file processing'''
    pass


class DataValidationError(PreprocessingError):
    '''Error during data validation'''
    pass


class ColumnDetectionError(PreprocessingError):
    '''Error detecting required columns'''
    pass


class TrainingError(Exception):
    '''Base exception for training errors'''
    pass


class InsufficientDataError(TrainingError):
    '''Not enough data for training'''
    pass


class ModelSaveError(TrainingError):
    '''Error saving model'''
    pass
