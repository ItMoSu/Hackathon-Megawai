import sys
import subprocess
import os

def diagnose_python_environment():
    """
    Tool diagnostic untuk memeriksa instalasi Python dan pip
    Seperti melakukan 'pengukuran' dalam eksperimen fisika
    """
    
    print("=" * 60)
    print("PYTHON ENVIRONMENT DIAGNOSTIC TOOL")
    print("=" * 60)
    
    # 1. Check Python version
    print("\n[1] Python Version:")
    print(f"    {sys.version}")
    print(f"    Executable: {sys.executable}")
    
    # 2. Check Python Path
    print("\n[2] Python Path (sys.path):")
    for i, path in enumerate(sys.path, 1):
        print(f"    {i}. {path}")
    
    # 3. Check pip installation
    print("\n[3] Checking pip installation:")
    try:
        import pip
        print(f"    ✓ pip module found: {pip.__version__}")
        print(f"    Location: {pip.__file__}")
    except ImportError:
        print("    ✗ pip module NOT found!")
        print("    Solution: Run 'python -m ensurepip --upgrade'")
    
    # 4. Check pip executable
    print("\n[4] Checking pip executable:")
    pip_locations = [
        os.path.join(os.path.dirname(sys.executable), 'pip.exe'),
        os.path.join(os.path.dirname(sys.executable), 'pip'),
        os.path.join(os.path.dirname(sys.executable), 'Scripts', 'pip.exe'),
        os.path.join(os.path.dirname(sys.executable), 'Scripts', 'pip'),
    ]
    
    found = False
    for loc in pip_locations:
        if os.path.exists(loc):
            print(f"    ✓ Found: {loc}")
            found = True
            break
    
    if not found:
        print("    ✗ pip executable NOT found in expected locations")
    
    # 5. Test pip command
    print("\n[5] Testing pip commands:")
    
    commands = [
        "pip --version",
        "python -m pip --version",
        f"{sys.executable} -m pip --version"
    ]
    
    for cmd in commands:
        try:
            result = subprocess.run(
                cmd, 
                shell=True, 
                capture_output=True, 
                text=True, 
                timeout=5
            )
            if result.returncode == 0:
                print(f"    ✓ '{cmd}' works!")
                print(f"      Output: {result.stdout.strip()}")
            else:
                print(f"    ✗ '{cmd}' failed")
                print(f"      Error: {result.stderr.strip()}")
        except Exception as e:
            print(f"    ✗ '{cmd}' error: {str(e)}")
    
    # 6. Recommendations
    print("\n" + "=" * 60)
    print("RECOMMENDATIONS:")
    print("=" * 60)
    print("\nTo install requirements.txt, use one of these commands:")
    print("  1. python -m pip install -r requirements.txt")
    print(f"  2. {sys.executable} -m pip install -r requirements.txt")
    print("  3. py -m pip install -r requirements.txt  (Windows only)")
    
    print("\nIf pip is not installed:")
    print("  python -m ensurepip --upgrade")
    print("  OR download: https://bootstrap.pypa.io/get-pip.py")
    print("  Then run: python get-pip.py")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    diagnose_python_environment()