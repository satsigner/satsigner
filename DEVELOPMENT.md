# Development

## Dev Environment Setup

### Prerequisites

- Node.js (minimum version 22.4.0)
- [pnpm](https://pnpm.io/installation)
- [just](https://github.com/casey/just#installation)

Note: You can install `just` with the following command: `npm install -g rust-just`

### Install dependencies

Install the dependencies at the root of the repository

```bash
pnpm install
```

### Set up Android environment

Set up Android Studio as usual. Otherwise, if you are using other IDE,
then install the packages `android-sdk`, `android-sdk-build-tools`,
`android-sdk-platform-tools`, and `android-tools`.

Once installed, set the environment variable `ANDROID_HOME` to point to
the location where the packages were installed, and update your `PATH`:

```bash
export ANDROID_HOME=/opt/android-sdk
export PATH=${PATH}:${ANDROID_HOME}/tools:${ANDROID_HOME}/tools/bin:${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/emulator
```

On some Linux systems, `ANDROID_HOME` may be `/opt/android-sdk`. On Windows,
it may be `/Users/username/Library/Android/sdk`. Set it accordingly.

Install Java JDK 8 in order to download the images from the upstream.
Also, make sure to enable JDK 8 before running `sdkmanager` commands,
because they seem to work only with this version. To enable it on
arch-based systems, run:

```bash
sudo archlinux-java set java-8-openjdk
```

This will make JDK 8 the default Java environment. We can then proceed to
using `sdkmanager`.

You can list the images with the following command:

```bash
sdkmanager --list
```

Select the SDK that fits your platform (`x86_64`, `arm64`, or other). Then
install the image with the command:

```bash
sdkmanager --install 'system-images;android-34;default;x86_64'
```

Of course, replace `system-images;android-34;default;arm64-v8a` with
the desired image name. This examples uses the default image for Android
SDK 34 for the `x86_64` (intel CPU) platform.

Then, create an emulator device:

```bash
avdmanager create avd -n myemulator -k 'system-images;android-34;default;x86_64'
```

Replace `myemulator` with the desired name for the emulator device and replace
`system-images;android-34;default;x86_64` with the image downloaded earlier.

Once the device has been created, switch your Java environment to **JDK 17** in
order to run and build this application. If you choose not use a device emulator
but use a physical one, then you would skip the previous steps (and not download
Java 8) but you still have to install Java 17 and set it as the default version.

Lastly, if you get the error `[CXX5304]` while building, try running `unset
_JAVA_OPTIONS` because this variable is sourced automatically and may pass
options that interfere with the building.

### Path issues

#### Windows users

Use `gitbash` as your shell instead of `powershell`. Then, create the
file `.bash_profile` in your home directory. It will be located in
`C:\Users\user\.bash_profile`, where `user` is your username. You can
create this file via the file explorer, via some IDE, or via the bash shell:

```bash
touch /c/Users/user/.bash_profile
```

Once created, open it in your editor or IDE and append the following lines:

```bash
export PATH="/c/Users/user/AppData/Local/Android/Sdk/platform-tools:$PATH"
export PATH="/c/Program Files/Java/jdk-17/bin:$PATH"
export ANDROID_HOME="/c/Users/user/AppData/Local/Android/Sdk"
```

Of course, change `user` to your username.

This will update your environment variables to include the binaries from Android
SDK and Java JDK 17, which you must have installed to develop satsigner.

#### Linux users

Update your `PATH` to include the directories `/opt/android-sdk/tools`,
`/opt/android-sdk/platform-tools`, and `/opt/android-sdk/tools/bin`. If you
want to use the emulator, also add the directory `/opt/android-sdk/emulator`
into your `PATH`.

```bash
export PATH=$PATH:${ANDROID_HOME}/tools:${ANDROID_HOME}/tools/bin:${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/emulator
```

**Tip**: use the tool `direnv` which loads environment variables dynamically
from a file called `.envrc` in the current directory (if it exists). To do
that, install and enable `direnv`, then create the file `apps/mobile/.envrc`
and place the content of the previous code block there.

### Set up Expo environment

Follow the expo documentation [here](https://docs.expo.dev/get-started/set-up-your-environment/)

Make sure to select "Development build" and disable "Build with Expo Application Services (EAS)"

Note: When starting a development server, do NOT run: `npx expo start`

### Run the app

Make sure you are on the `mobile` folder

```bash
cd apps/mobile
```

Run for android or iOS

```bash
pnpm android

pnpm ios
```
