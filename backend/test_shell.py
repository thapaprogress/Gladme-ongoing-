import shutil
import os
print(f"powershell.exe: {shutil.which('powershell.exe')}")
print(f"cmd.exe: {shutil.which('cmd.exe')}")
print(f"COMSPEC: {os.environ.get('COMSPEC')}")
print(f"PATH: {os.environ.get('PATH')}")
