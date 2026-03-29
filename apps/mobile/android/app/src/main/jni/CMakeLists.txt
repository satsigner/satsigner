cmake_minimum_required(VERSION 3.13)

project(appmodules)

# Compatibility shim: target_compile_reactnative_options was introduced in
# React Native 0.77. It applies C++20 and standard compile flags to codegen
# targets. react-native-bdk-sdk@0.1.6 ships pre-generated codegen that was
# built for RN 0.77+ and requires this function. Without it (or without
# -std=c++20), compilation fails on C++20 concept syntax in RN headers.
function(target_compile_reactnative_options target)
  target_compile_options(${target} ${ARGN}
    -std=c++20
    -DFOLLY_NO_CONFIG=1
    -DFOLLY_HAVE_CLOCK_GETTIME=1
    -DFOLLY_USE_LIBCPP=1
    -DFOLLY_CFG_NO_COROUTINES=1
    -DFOLLY_MOBILE=1
  )
endfunction()

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)
