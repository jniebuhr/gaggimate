#ifndef FSUTIL_H
#define FSUTIL_H

#include <FS.h>

namespace fs_util {

// True for dot-files like macOS "._x.json" / ".DS_Store"; GaggiMate never writes those.
bool isHiddenPath(const String &path);

// True when the root holds nothing but hidden entries and OS bookkeeping folders.
bool isEmptyVolume(fs::FS &fs);

// Recursively copies non-hidden files under dir from src to dst, overwriting existing files.
bool copyTree(fs::FS &src, fs::FS &dst, const String &dir = "/");

} // namespace fs_util

#endif
