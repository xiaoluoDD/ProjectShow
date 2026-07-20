#ifndef APPVERSION_H
#define APPVERSION_H

#include <QString>

namespace AppVersion {

constexpr int kMajor = 1;
constexpr int kMinor = 2;
constexpr int kPatch = 1;

inline QString number()
{
    return QStringLiteral("%1.%2.%3").arg(kMajor).arg(kMinor).arg(kPatch);
}

inline QString display()
{
    return QStringLiteral("v") + number();
}

inline QString windowTitle()
{
    return QStringLiteral("项目看板 %1").arg(display());
}

} // namespace AppVersion

// 发布新版本时同步更新：core/appversion.h、ProjectShow.pro VERSION、my-backend-services/changelog.json、web/js/config.js
// 变更记录保存在云端服务器仓库 changelog.json，客户端通过 GET /api/changelog 读取

#endif // APPVERSION_H
