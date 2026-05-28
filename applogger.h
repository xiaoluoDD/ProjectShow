#ifndef APPLOGGER_H
#define APPLOGGER_H

#include <QObject>
#include <QString>
#include <QStringList>

class AppLogger : public QObject
{
    Q_OBJECT

public:
    enum class Level {
        Debug = 0,
        Info = 1,
        Warn = 2,
        Error = 3,
    };
    Q_ENUM(Level)

    static AppLogger &instance();

    void init();
    void setMinLevel(Level level);
    Level minLevel() const;

    void log(Level level, const QString &category, const QString &message);

    void debug(const QString &category, const QString &message);
    void info(const QString &category, const QString &message);
    void warn(const QString &category, const QString &message);
    void error(const QString &category, const QString &message);

    QString logDirectory() const;
    QString currentLogFilePath() const;
    QStringList recentLines() const;

    static QString levelToString(Level level);

signals:
    void logRecorded(const QString &formattedLine, AppLogger::Level level);

private:
    explicit AppLogger(QObject *parent = nullptr);

    bool shouldLog(Level level) const;
    QString formatLine(Level level, const QString &category, const QString &message) const;
    void appendToFile(const QString &line);
    void appendRecent(const QString &line);

    Level m_minLevel = Level::Debug;
    QString m_logDir;
    QString m_logFilePath;
    QStringList m_recentLines;
    static constexpr int kMaxRecentLines = 3000;
};

#endif // APPLOGGER_H
