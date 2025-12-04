import os
import glob

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
print(f"BASE_DIR: {BASE_DIR}")

# Test path 1
training_models = glob.glob(os.path.join(BASE_DIR, "training", "models_output", "xgboost_*.pkl"))
print(f"\nTraining models found: {len(training_models)}")
for m in training_models[:5]:
    print(f"  - {os.path.basename(m)}")

# Test path 2
prod_models = glob.glob(os.path.join(BASE_DIR, "models", "xgboost_*.pkl"))
print(f"\nProd models found: {len(prod_models)}")

# Test path 3
artifact_models = glob.glob(os.path.join(BASE_DIR, "models", "artifacts", "xgboost_*.pkl"))
print(f"\nArtifact models found: {len(artifact_models)}")

print(f"\nTotal: {len(training_models) + len(prod_models) + len(artifact_models)}")