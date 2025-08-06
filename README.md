Edited by paulthefree - updating README to include satsigner app installation on Windows.
 
Steps to run satsigner dev version on Windows:
1.	Open Vscode or other IDE
2.	Open Satsigner folder at C://Users/<username>/OneDrive/Documents/Github/satsigner(or /c/Users/<username>/ Documents/Github/satsigner)
3.	Open the terminal
4.	Run cd apps/mobile to switch the working directory to our mobile app
5.	Run yarn to install the packages(yarn)
6.	Run yarn android to launch development build for Android(yarn android --device)
Last step may fail due to incompatible Java versions in our system.
Also, it is suggested to connect a physical android to your computer and run yarn android --device and select your phone to connect. This will avoid the need to create an emulator phone, a virtual-like phone, which requires more steps
Up to step 5 everything should work out seamlessly

Common problems troubleshooting:
Remember to Click on the dropdown menu and select Bash on the terminal panel. If you encounter a "binary not found in PATH" problems
Make sure you have installed the exact Java SDK version(in this case,its Java SDK 17)
Open the bashrc or bash_profile file on the IDE(pseronally using VSCode) (C:\\Users\paul.bashrc)
Type the following & save the file:
#!/bin/bash
export PATH="/c/Users/pault/AppData/Local/Android/Sdk/platform-tools:$PATH"
export PATH="/c/Program Files/Java/jdk-17/bin:$PATH"
export ANDROID_HOME="/c/Users/pault/AppData/Local/Android/Sdk"
