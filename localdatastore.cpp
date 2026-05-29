#include "localdatastore.h"

#include <QCoreApplication>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QSaveFile>

namespace {

QString snapshotDir()
{
    return QCoreApplication::applicationDirPath() + QStringLiteral("/data/backend");
}

} // namespace

QString LocalDataStore::dataDirectory()
{
    return snapshotDir();
}

bool LocalDataStore::ensureDataDirectory()
{
    QDir dir;
    return dir.mkpath(snapshotDir());
}

QString LocalDataStore::saveSnapshot(const QJsonObject &exportRoot)
{
    if (!ensureDataDirectory())
        return QString();

    const QString stamp = QDateTime::currentDateTime().toString(QStringLiteral("yyyy-MM-dd_HHmmss"));
    const QString fileName = QStringLiteral("snapshot-%1.json").arg(stamp);
    const QString filePath = snapshotDir() + QLatin1Char('/') + fileName;
    const QString latestPath = latestSnapshotPath();

    const QByteArray body = QJsonDocument(exportRoot).toJson(QJsonDocument::Indented);

    auto writeFile = [](const QString &path, const QByteArray &data) -> bool {
        QSaveFile file(path);
        if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate))
            return false;
        if (file.write(data) != data.size())
            return false;
        return file.commit();
    };

    if (!writeFile(filePath, body))
        return QString();
    if (!writeFile(latestPath, body))
        return QString();

    return filePath;
}

QString LocalDataStore::latestSnapshotPath()
{
    return snapshotDir() + QStringLiteral("/snapshot-latest.json");
}

QStringList LocalDataStore::listSnapshots()
{
    QDir dir(snapshotDir());
    if (!dir.exists())
        return {};

    const QStringList files =
        dir.entryList({QStringLiteral("snapshot-*.json")}, QDir::Files, QDir::Name);
    QStringList out;
    out.reserve(files.size());
    for (const QString &name : files) {
        if (name == QStringLiteral("snapshot-latest.json"))
            continue;
        out.append(dir.absoluteFilePath(name));
    }
    out.sort();
    QStringList reversed;
    reversed.reserve(out.size());
    for (int i = out.size() - 1; i >= 0; --i)
        reversed.append(out.at(i));
    return reversed;
}

bool LocalDataStore::readSnapshot(const QString &path, QJsonObject *out, QString *errorOut)
{
    if (!out)
        return false;

    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        if (errorOut)
            *errorOut = file.errorString();
        return false;
    }

    QJsonParseError parseErr;
    const QJsonDocument doc = QJsonDocument::fromJson(file.readAll(), &parseErr);
    if (parseErr.error != QJsonParseError::NoError || !doc.isObject()) {
        if (errorOut)
            *errorOut = parseErr.errorString();
        return false;
    }

    *out = doc.object();
    return true;
}

QString LocalDataStore::buildSummaryText(const QJsonObject &exportRoot)
{
    const QJsonObject count = exportRoot.value(QStringLiteral("count")).toObject();
    const int userCount = count.value(QStringLiteral("users")).toInt(
        exportRoot.value(QStringLiteral("users")).toArray().size());
    const int projectCount = count.value(QStringLiteral("projects")).toInt(
        exportRoot.value(QStringLiteral("projects")).toArray().size());

    const QJsonObject stats = exportRoot.value(QStringLiteral("stats")).toObject();
    const int activeUsers = stats.value(QStringLiteral("active_users")).toInt(userCount);

    QStringList lines;
    lines << QStringLiteral("导出时间：%1")
                 .arg(exportRoot.value(QStringLiteral("exported_at")).toString());
    lines << QStringLiteral("服务器时间：%1")
                 .arg(exportRoot.value(QStringLiteral("server_now")).toString());
    lines << QStringLiteral("成员：%1 人（stats.active_users=%2）")
                 .arg(QString::number(userCount), QString::number(activeUsers));
    lines << QStringLiteral("项目：%1 条").arg(projectCount);

    const QJsonObject lastSync = stats.value(QStringLiteral("last_sync")).toObject();
    if (!lastSync.isEmpty()) {
        lines << QStringLiteral("最近同步：%1  status=%2  users=%3")
                     .arg(lastSync.value(QStringLiteral("finished_at")).toString(
                         lastSync.value(QStringLiteral("started_at")).toString()),
                          lastSync.value(QStringLiteral("status")).toString(),
                          QString::number(lastSync.value(QStringLiteral("user_count")).toInt()));
    }

    const QJsonObject corp = stats.value(QStringLiteral("corp_info")).toObject();
    if (!corp.isEmpty()) {
        lines << QStringLiteral("企业信息：");
        for (auto it = corp.begin(); it != corp.end(); ++it)
            lines << QStringLiteral("  %1 = %2").arg(it.key(), it.value().toString());
    }

    lines << QString();
    lines << QStringLiteral("—— 项目列表 ——");
    const QJsonArray projects = exportRoot.value(QStringLiteral("projects")).toArray();
    for (const QJsonValue &v : projects) {
        const QJsonObject p = v.toObject();
        lines << QStringLiteral("[%1] %2 / %3 — %4（%5）状态:%6")
                     .arg(QString::number(p.value(QStringLiteral("id")).toInt()),
                          p.value(QStringLiteral("year")).toString(),
                          p.value(QStringLiteral("work_no")).toString(),
                          p.value(QStringLiteral("name")).toString(),
                          p.value(QStringLiteral("manager_name")).toString(),
                          p.value(QStringLiteral("status")).toString());
    }

    lines << QString();
    lines << QStringLiteral("—— 成员列表 ——");
    const QJsonArray users = exportRoot.value(QStringLiteral("users")).toArray();
    for (const QJsonValue &v : users) {
        const QJsonObject u = v.toObject();
        const QString name = u.value(QStringLiteral("name")).toString();
        const QString userid = u.value(QStringLiteral("userid")).toString();
        lines << (name.isEmpty() ? userid : QStringLiteral("%1 (%2)").arg(name, userid));
    }

    return lines.join(QLatin1Char('\n'));
}

QString LocalDataStore::saveDatabaseFile(const QByteArray &data)
{
    if (data.isEmpty() || !ensureDataDirectory())
        return QString();

    const QString stamp = QDateTime::currentDateTime().toString(QStringLiteral("yyyy-MM-dd_HHmmss"));
    const QString filePath = snapshotDir() + QStringLiteral("/wecom-") + stamp + QStringLiteral(".db");
    const QString latestPath = snapshotDir() + QStringLiteral("/wecom-latest.db");

    auto writeFile = [](const QString &path, const QByteArray &payload) -> bool {
        QSaveFile file(path);
        if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate))
            return false;
        if (file.write(payload) != payload.size())
            return false;
        return file.commit();
    };

    if (!writeFile(filePath, data))
        return QString();
    if (!writeFile(latestPath, data))
        return QString();

    return filePath;
}

QStringList LocalDataStore::listDatabaseFiles()
{
    QDir dir(snapshotDir());
    if (!dir.exists())
        return {};

    QStringList files =
        dir.entryList({QStringLiteral("wecom-*.db")}, QDir::Files, QDir::Name);
    QStringList out;
    out.reserve(files.size());
    for (const QString &name : files) {
        if (name == QStringLiteral("wecom-latest.db"))
            continue;
        out.append(dir.absoluteFilePath(name));
    }
    out.sort();
    QStringList reversed;
    reversed.reserve(out.size());
    for (int i = out.size() - 1; i >= 0; --i)
        reversed.append(out.at(i));
    return reversed;
}
