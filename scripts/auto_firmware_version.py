import subprocess
import datetime

Import("env")

def get_firmware_specifier():
    ret = subprocess.run(["git", "describe", "--tags", "--dirty", "--exclude", "nightly"], stdout=subprocess.PIPE, text=True) #Uses any tags
    build_version = ret.stdout.strip()
    print ("Build version: " + build_version)
    return build_version

def get_time_specifier():
    build_timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    print ("Build date: " + build_timestamp)
    return build_timestamp

with open('src/version.cpp', 'w') as f:
    f.write(
        f"""#include <Arduino.h>
extern const String BUILD_GIT_VERSION = "{get_firmware_specifier()}";
extern const String BUILD_TIMESTAMP = "{get_time_specifier()}";
""")
