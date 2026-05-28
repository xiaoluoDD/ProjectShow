#include "applogger.h"

#include <QCoreApplication>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QMutex>
#include <QMutexLocker>
#include <QSettings>
#include <QStringConverter>
#include <QTextStream>

namespace {

QMutex g_logMutex;

AppLogger::Level levelFromSettings()
{
    const QString v = QSettings().value(QStringLiteral("log/minLevel"), QStringLiteral("debug")).toString();
    if (v == QLatin1String("info"))
        return AppLogger::Level::Info;
    if (v == QLatin1String("warn"))
        return AppLogger::Level::Warn;
    if (v == QLatin1String("error"))
        return AppLogger::Level::Error;
    return AppLogger::Level::Debug;
}

} // namespace

AppLogger &AppLogger::instance()
{
    static AppLogger logger;
    return logger;
}

AppLogger::AppLogger(QObject *parent)
    : QObject(parent)
{
}

void AppLogger::init()
{
    m_minLevel = levelFromSettings();

    const QString exeDir = QCoreApplication::applicationDirPath();
    m_logDir = exeDir + QStringLiteral("/logs");
    QDir().mkpath(m_logDir);

    const QString date = QDateTime::currentDateTime().toString(QStringLiteral("yyyy-MM-dd"));
    m_logFilePath = m_logDir + QStringLiteral("/ProjectKanban-") + date + QStringLiteral(".log");

    info(QStringLiteral("App"), QStringLiteral("日志模块已启动，文件：%1").arg(m_logFilePath));
}

void AppLogger::setMinLevel(Level level)
{
    m_minLevel = level;
    QSettings settings;
    settings.setValue(QStringLiteral("log/minLevel"), levelToString(level).toLower());
}

AppLogger::Level AppLogger::minLevel() const
{
    return m_minLevel;
}

QString AppLogger::levelToString(Level level)
{
    switch (level) {
    case Level::Debug:
        return QStringLiteral("DEBUG");
    case Level::Info:
        return QStringLiteral("INFO");
    case Level::Warn:
        return QStringLiteral("WARN");
    case Level::Error:
        return QStringLiteral("ERROR");
    }
    return QStringLiteral("INFO");
}

bool AppLogger::shouldLog(Level level) const
{
    return static_cast<int>(level) >= static_cast<int>(m_minLevel);
}

QString AppLogger::formatLine(Level level, const QString &category, const QString &message) const
{
    return QDateTime::currentDateTime().toString(QStringLiteral("yyyy-MM-dd hh:mm:ss"))
           + QStringLiteral(" [") + levelToString(level) + QStringLiteral("][") + category
           + QStringLiteral("] ") + message;
}

void AppLogger::appendToFile(const QString &line)
{
    QMutexLocker lock(&g_logMutex);
    QFile file(m_logFilePath);
    if (file.open(QIODevice::WriteOnly | QIODevice::Append | QIODevice::Text)) {
        QTextStream out(&file);
        out.setEncoding(QStringConverter::Utf8);
        out << line << '\n';
    }
}

void AppLogger::appendRecent(const QString &line)
{
    m_recentLines.append(line);
    while (m_recentLines.size() > kMaxRecentLines)
        m_recentLines.removeFirst();
}

void AppLogger::log(Level level, const QString &category, const QString &message)
{
    if (!shouldLog(level))
        return;

    const QString line = formatLine(level, category, message);
    appendToFile(line);
    appendRecent(line);
    emit logRecorded(line, level);
}

void AppLogger::debug(const QString &category, const QString &message)
{
    log(Level::Debug, category, message);
}

void AppLogger::info(const QString &category, const QString &message)
{
    log(Level::Info, category, message);
}

void AppLogger::warn(const QString &category, const QString &message)
{
    log(Level::Warn, category, message);
}

void AppLogger::error(const QString &category, const QString &message)
{
    log(Level::Error, category, message);
}

QString AppLogger::logDirectory() const
{
    return m_logDir;
}

QString AppLogger::currentLogFilePath() const
{
    return m_logFilePath;
}

QStringList AppLogger::recentLines() const
{
    return m_recentLines;
}
