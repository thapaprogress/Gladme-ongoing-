try:
    from winpty import PtyProcess
    print("SUCCESS: from winpty import PtyProcess worked")
except ImportError as e:
    print(f"FAILED: {e}")
    try:
        import winpty
        print(f"winpty imported, but PtyProcess not found. Dir: {dir(winpty)}")
    except ImportError:
        print("winpty not found at all")
