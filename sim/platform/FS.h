// Host shim for Arduino FS.h: maps the Arduino FS/File API onto the host
// filesystem. Each filesystem (LittleFS/SD_MMC) is rooted at a host directory.
#pragma once

#include "Stream.h"
#include "WString.h"
#include <cstdio>
#include <dirent.h>
#include <memory>
#include <string>
#include <sys/stat.h>

#define FILE_READ "r"
#define FILE_WRITE "w"
#define FILE_APPEND "a"

namespace fs {

enum SeekMode { SeekSet = 0, SeekCur = 1, SeekEnd = 2 };

// Shared handle so File can be copied/returned by value like the Arduino class.
struct FileHandle {
    FILE *fp = nullptr;
    DIR *dir = nullptr;
    std::string hostPath;    // absolute host path
    std::string logicalPath; // path as the firmware sees it (e.g. "/p/x.json")
    bool isDir = false;
    ~FileHandle() {
        if (fp)
            fclose(fp);
        if (dir)
            closedir(dir);
    }
};

class File : public Stream {
  public:
    File() = default;
    explicit File(std::shared_ptr<FileHandle> h) : _h(std::move(h)) {}

    explicit operator bool() const { return _h && (_h->fp || _h->isDir); }

    // Print/Stream
    size_t write(uint8_t c) override { return _h && _h->fp ? fwrite(&c, 1, 1, _h->fp) : 0; }
    size_t write(const uint8_t *buf, size_t size) override { return _h && _h->fp ? fwrite(buf, 1, size, _h->fp) : 0; }
    int available() override {
        if (!_h || !_h->fp)
            return 0;
        long cur = ftell(_h->fp);
        return (int)(size() - cur);
    }
    int read() override {
        if (!_h || !_h->fp)
            return -1;
        int c = fgetc(_h->fp);
        return c == EOF ? -1 : c;
    }
    int peek() override {
        if (!_h || !_h->fp)
            return -1;
        int c = fgetc(_h->fp);
        if (c != EOF)
            ungetc(c, _h->fp);
        return c == EOF ? -1 : c;
    }
    size_t read(uint8_t *buf, size_t size) { return _h && _h->fp ? fread(buf, 1, size, _h->fp) : 0; }
    void flush() override {
        if (_h && _h->fp)
            fflush(_h->fp);
    }

    size_t size() {
        if (!_h || !_h->fp)
            return 0;
        struct stat st;
        if (stat(_h->hostPath.c_str(), &st) == 0)
            return (size_t)st.st_size;
        return 0;
    }
    bool seek(uint32_t pos, SeekMode mode = SeekSet) {
        if (!_h || !_h->fp)
            return false;
        return fseek(_h->fp, pos, mode == SeekSet ? SEEK_SET : (mode == SeekCur ? SEEK_CUR : SEEK_END)) == 0;
    }
    size_t position() { return _h && _h->fp ? (size_t)ftell(_h->fp) : 0; }

    void close() { _h.reset(); }
    bool isDirectory() { return _h && _h->isDir; }
    const char *path() { return _h ? _h->logicalPath.c_str() : ""; }
    const char *name() {
        if (!_h)
            return "";
        size_t slash = _h->logicalPath.find_last_of('/');
        _name = slash == std::string::npos ? _h->logicalPath : _h->logicalPath.substr(slash + 1);
        return _name.c_str();
    }
    File openNextFile(const char *mode = "r");
    String getNextFileName();
    String getNextFileName(bool *isDir);

  private:
    std::shared_ptr<FileHandle> _h;
    std::string _name;
};

class FS {
  public:
    virtual ~FS() = default;

    File open(const char *path, const char *mode = "r", bool create = false);
    File open(const String &path, const char *mode = "r", bool create = false) { return open(path.c_str(), mode, create); }
    bool exists(const char *path);
    bool exists(const String &path) { return exists(path.c_str()); }
    bool remove(const char *path);
    bool remove(const String &path) { return remove(path.c_str()); }
    bool mkdir(const char *path);
    bool mkdir(const String &path) { return mkdir(path.c_str()); }
    bool rmdir(const char *path);
    bool rename(const char *from, const char *to);
    size_t totalBytes() { return 16u * 1024u * 1024u; }
    size_t usedBytes() { return 1u * 1024u * 1024u; }

  protected:
    std::string _root; // host directory backing this filesystem
    std::string hostPath(const char *logical) const;
};

} // namespace fs

using fs::File;
using fs::FS;
using fs::SeekCur;
using fs::SeekEnd;
using fs::SeekMode;
using fs::SeekSet;
