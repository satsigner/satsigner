Test Edit by paulthefree - updating README for demo purposes.

#
 Satsignerwidth
=
"594"
 
alt
=
"image"
 
src
=
"https://user-images.githubusercontent.com/807505/183712134-d1f56508-4576-4c6b-b262-3e09dee9cd31.png"
>https://twitter.com/pedromvpg/status/1553123963139756032
##
 Why work on this?
-
 Help build a powerful native mobile Bitcoin signer management application
-
 Contribute towards the integration, development and enhancement of Bitcoin UX design
-
 Unlock coin insights via integrated onchain (privacy/provenance/economic) analyses and corresponding data visualisation to help inform, encourage and automate better Bitcoin usage best-pratices
-
 Advance Bitcoin understanding
-
 Test market demand for bitcoin centric applications
-
 Propagate open-source ethos
-
 Build and support Bitcoin and related FOSS projects
-
 Participate in Bitcoin history
###
 Ethos/priorities/design philosophy
-
 Bitcoin only
-
 Sat denomination supremacy
-
 Initial focus on on-chain bitcoin (coin-control/controlling sats)
-
 Emphasis on privacy
-
 Emphasis on personal labeling, tagging, and bookmarking
-
 Application of visualisation/visual-native UI aiming to build upon and develop new Bitcoin design primitives to help make more advanced/poower-user Bitcoin UX/UI more intuitive and accessible
-
 Take advantage of appropriate charts and graphic layouts for all data vizualisation
-
 Security - targetting optimal hot-signer-level security initially (future support for watch-only cold, multisig, vaults etc)
-
 Visually crafted and UX builds upon powerful feattures and improvements introoduced by the many existing brilliant open-soouurce FullyNoded, or Sparrow
-
 An intuitive and powerful mobile bitcoin app
##
 Features
###
 Main features and goals
-
 Experimental bitcoin centric lexicon
  
-
 Send bitcoin -> Sign bitcoin messages
  
-
 Spend bitcoin -> Consume UTXO
  
-
 Bitcoin balance -> Total spendable sats
  
-
 Wallet -> Signer
  
-
 Private key -> Account
 
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
