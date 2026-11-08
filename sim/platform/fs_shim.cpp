// Implementation of the host FS shim + the LittleFS/SPIFFS/SD_MMC instances.
#include "FS.h"
#include "LittleFS.h"
#include "SD_MMC.h"
#include "SPIFFS.h"

#include <cstring>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

namespace fs {

std::string FS::hostPath(const char *logical) const {
    std::string p = logical ? logical : "";
    if (p.empty())
        return _root;
    if (p[0] != '/')
        p = "/" + p;
    return _root + p;
}

// Create every directory component of a host path (like `mkdir -p`).
static void makeHostDirs(const std::string &path) {
    std::string acc;
    size_t i = 0;
    while (i < path.size()) {
        size_t next = path.find('/', i + 1);
        if (next == std::string::npos)
            next = path.size();
        acc = path.substr(0, next);
        if (!acc.empty())
            ::mkdir(acc.c_str(), 0755);
        i = next;
    }
}

File FS::open(const char *path, const char *mode, bool create) {
    (void)create;
    std::string host = hostPath(path);

    struct stat st;
    bool exists = stat(host.c_str(), &st) == 0;
    if (exists && S_ISDIR(st.st_mode)) {
        auto h = std::make_shared<FileHandle>();
        h->dir = opendir(host.c_str());
        h->hostPath = host;
        h->logicalPath = path ? path : "/";
        h->isDir = true;
        return File(h->dir ? h : nullptr);
    }

    // Writing? Make sure the parent directory tree exists first.
    if (mode && (mode[0] == 'w' || mode[0] == 'a')) {
        size_t slash = host.find_last_of('/');
        if (slash != std::string::npos)
            makeHostDirs(host.substr(0, slash));
    }

    FILE *fp = fopen(host.c_str(), mode ? mode : "r");
    if (!fp)
        return File();
    auto h = std::make_shared<FileHandle>();
    h->fp = fp;
    h->hostPath = host;
    h->logicalPath = path ? path : "";
    return File(h);
}

bool FS::exists(const char *path) {
    struct stat st;
    return stat(hostPath(path).c_str(), &st) == 0;
}
bool FS::remove(const char *path) { return ::remove(hostPath(path).c_str()) == 0; }
bool FS::mkdir(const char *path) {
    makeHostDirs(hostPath(path));
    return true;
}
bool FS::rmdir(const char *path) { return ::rmdir(hostPath(path).c_str()) == 0; }
bool FS::rename(const char *from, const char *to) { return ::rename(hostPath(from).c_str(), hostPath(to).c_str()) == 0; }

File File::openNextFile(const char *mode) {
    if (!_h || !_h->dir)
        return File();
    struct dirent *ent;
    while ((ent = readdir(_h->dir)) != nullptr) {
        if (strcmp(ent->d_name, ".") == 0 || strcmp(ent->d_name, "..") == 0)
            continue;
        std::string childLogical = _h->logicalPath;
        if (childLogical.empty() || childLogical.back() != '/')
            childLogical += "/";
        childLogical += ent->d_name;
        std::string childHost = _h->hostPath + "/" + ent->d_name;

        struct stat st;
        if (stat(childHost.c_str(), &st) != 0)
            continue;
        auto h = std::make_shared<FileHandle>();
        h->hostPath = childHost;
        h->logicalPath = childLogical;
        if (S_ISDIR(st.st_mode)) {
            h->dir = opendir(childHost.c_str());
            h->isDir = true;
        } else {
            h->fp = fopen(childHost.c_str(), mode ? mode : "r");
            if (!h->fp)
                continue;
        }
        return File(h);
    }
    return File();
}

String File::getNextFileName() { return getNextFileName(nullptr); }

String File::getNextFileName(bool *isDir) {
    if (!_h || !_h->dir)
        return String();
    struct dirent *ent;
    while ((ent = readdir(_h->dir)) != nullptr) {
        if (strcmp(ent->d_name, ".") == 0 || strcmp(ent->d_name, "..") == 0)
            continue;
        std::string childLogical = _h->logicalPath;
        if (childLogical.empty() || childLogical.back() != '/')
            childLogical += "/";
        childLogical += ent->d_name;
        if (isDir) {
            struct stat st;
            std::string childHost = _h->hostPath + "/" + ent->d_name;
            *isDir = stat(childHost.c_str(), &st) == 0 && S_ISDIR(st.st_mode);
        }
        return String(childLogical.c_str());
    }
    return String();
}

bool LittleFSFS::begin(bool, const char *, uint8_t, const char *) {
    _root = "sim_data/littlefs";
    ::mkdir("sim_data", 0755);
    ::mkdir(_root.c_str(), 0755);
    return true;
}

bool SPIFFSFS::begin(bool, const char *, uint8_t, const char *) {
    _root = "sim_data/spiffs";
    ::mkdir("sim_data", 0755);
    ::mkdir(_root.c_str(), 0755);
    return true;
}

} // namespace fs

fs::LittleFSFS LittleFS;
fs::SPIFFSFS SPIFFS;
fs::SDMMCFS SD_MMC;
