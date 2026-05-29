#ifndef LOCALDATASTORE_H
#define LOCALDATASTORE_H

#include <QByteArray>
#include <QJsonObject>
#include <QString>
#include <QStringList>

class LocalDataStore
{
public:
    static QString dataDirectory();
    static bool ensureDataDirectory();

    /// 保存导出 JSON，返回写入的文件路径；失败返回空字符串。
    static QString saveSnapshot(const QJsonObject &exportRoot);

    static QString latestSnapshotPath();
    static QStringList listSnapshots();
    static bool readSnapshot(const QString &path, QJsonObject *out, QString *errorOut = nullptr);

    static QString buildSummaryText(const QJsonObject &exportRoot);

    /// 保存下载的 .db 文件，返回带时间戳的路径；失败返回空字符串。
    static QString saveDatabaseFile(const QByteArray &data);
    static QStringList listDatabaseFiles();
};

#endif // LOCALDATASTORE_H
