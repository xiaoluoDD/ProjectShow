#include "logpanelwidget.h"

#include "mainwindow.h"

#include <QAbstractItemView>
#include <QComboBox>
#include <QCoreApplication>
#include <QDesktopServices>
#include <QDir>
#include <QFile>
#include <QFont>
#include <QHBoxLayout>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QListWidget>
#include <QListWidgetItem>
#include <QMessageBox>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QSettings>
#include <QTextCursor>
#include <QUrl>
#include <QVBoxLayout>

namespace {

const char kRequestKind[] = "requestKind";
const char kOwnerPanel[] = "ownerPanel";

QString formatFileSize(qint64 bytes)
{
    if (bytes < 1024)
        return QString::number(bytes) + QStringLiteral(" B");
    if (bytes < 1024 * 1024)
        return QString::number(bytes / 1024.0, 'f', 1) + QStringLiteral(" KB");
    return QString::number(bytes / (1024.0 * 1024.0), 'f', 1) + QStringLiteral(" MB");
}

} // namespace

LogPanelWidget::LogPanelWidget(QWidget *parent)
    : QWidget(parent)
{
    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(0, 8, 0, 0);

    auto *hint = new QLabel(
        QStringLiteral("本地日志在 exe 同级 logs/；可从服务器拉取后端 logs/ 目录下的日志文件并打开。"),
        this);
    hint->setWordWrap(true);
    hint->setStyleSheet(QStringLiteral("color: #666;"));
    root->addWidget(hint);

    auto *serverTitle = new QLabel(QStringLiteral("后端日志"), this);
    serverTitle->setStyleSheet(QStringLiteral("font-weight: bold;"));
    root->addWidget(serverTitle);

    auto *serverTool = new QHBoxLayout;
    m_fetchServerLogsBtn = new QPushButton(QStringLiteral("获取后端日志列表"), this);
    m_openServerLogBtn = new QPushButton(QStringLiteral("打开选中日志"), this);
    m_openServerLogBtn->setEnabled(false);
    serverTool->addWidget(m_fetchServerLogsBtn);
    serverTool->addWidget(m_openServerLogBtn);
    serverTool->addStretch();
    root->addLayout(serverTool);

    m_serverLogList = new QListWidget(this);
    m_serverLogList->setMaximumHeight(120);
    m_serverLogList->setSelectionMode(QAbstractItemView::SingleSelection);
    root->addWidget(m_serverLogList);

    auto *localTitle = new QLabel(QStringLiteral("本地运行日志"), this);
    localTitle->setStyleSheet(QStringLiteral("font-weight: bold;"));
    root->addWidget(localTitle);

    auto *tool = new QHBoxLayout;
    tool->addWidget(new QLabel(QStringLiteral("最低级别："), this));
    m_levelFilter = new QComboBox(this);
    m_levelFilter->addItem(QStringLiteral("全部 (Debug)"), static_cast<int>(AppLogger::Level::Debug));
    m_levelFilter->addItem(QStringLiteral("Info 及以上"), static_cast<int>(AppLogger::Level::Info));
    m_levelFilter->addItem(QStringLiteral("Warn 及以上"), static_cast<int>(AppLogger::Level::Warn));
    m_levelFilter->addItem(QStringLiteral("仅 Error"), static_cast<int>(AppLogger::Level::Error));
    tool->addWidget(m_levelFilter);
    tool->addStretch();
    m_clearBtn = new QPushButton(QStringLiteral("清空显示"), this);
    m_openFolderBtn = new QPushButton(QStringLiteral("打开本地日志目录"), this);
    tool->addWidget(m_clearBtn);
    tool->addWidget(m_openFolderBtn);
    root->addLayout(tool);

    m_view = new QPlainTextEdit(this);
    m_view->setReadOnly(true);
    m_view->setLineWrapMode(QPlainTextEdit::NoWrap);
    QFont mono = m_view->font();
    mono.setStyleHint(QFont::Monospace);
    m_view->setFont(mono);
    root->addWidget(m_view, 1);

    const auto &logger = AppLogger::instance();
    for (const QString &line : logger.recentLines())
        appendLine(line, AppLogger::Level::Info);

    connect(&AppLogger::instance(), &AppLogger::logRecorded, this, &LogPanelWidget::onLogRecorded);
    connect(m_clearBtn, &QPushButton::clicked, this, &LogPanelWidget::onClearClicked);
    connect(m_openFolderBtn, &QPushButton::clicked, this, &LogPanelWidget::onOpenFolderClicked);
    connect(m_levelFilter, QOverload<int>::of(&QComboBox::currentIndexChanged), this,
            &LogPanelWidget::onLevelFilterChanged);
    connect(m_fetchServerLogsBtn, &QPushButton::clicked, this, &LogPanelWidget::onFetchServerLogsClicked);
    connect(m_openServerLogBtn, &QPushButton::clicked, this, &LogPanelWidget::onOpenServerLogClicked);
    connect(m_serverLogList, &QListWidget::itemSelectionChanged, this, [this]() {
        m_openServerLogBtn->setEnabled(m_serverLogList->currentItem() != nullptr);
    });
    connect(mainWindow()->networkManager(), &QNetworkAccessManager::finished, this,
            &LogPanelWidget::onNetworkReplyFinished);

    AppLogger::instance().info(QStringLiteral("LogUI"), QStringLiteral("日志页已就绪"));
}

MainWindow *LogPanelWidget::mainWindow() const
{
    return qobject_cast<MainWindow *>(window());
}

QString LogPanelWidget::serverLogCacheDir() const
{
    const QString dir = QCoreApplication::applicationDirPath() + QStringLiteral("/logs/server");
    QDir().mkpath(dir);
    return dir;
}

bool LogPanelWidget::checkServerUrl(QString *baseOut)
{
    const auto *mw = mainWindow();
    if (!mw)
        return false;

    const QString base = mw->serverBaseUrl();
    if (base.isEmpty()) {
        QMessageBox::warning(this, QStringLiteral("提示"), QStringLiteral("请在窗口顶部填写后端地址"));
        return false;
    }
    QSettings settings;
    settings.setValue(QStringLiteral("serverBaseUrl"), base);
    if (baseOut)
        *baseOut = base;
    return true;
}

bool LogPanelWidget::passFilter(AppLogger::Level level) const
{
    return static_cast<int>(level) >= static_cast<int>(m_filterMin);
}

void LogPanelWidget::appendLine(const QString &line, AppLogger::Level level)
{
    if (!passFilter(level))
        return;

    m_view->appendPlainText(line);
    auto cursor = m_view->textCursor();
    cursor.movePosition(QTextCursor::End);
    m_view->setTextCursor(cursor);
}

void LogPanelWidget::onLogRecorded(const QString &line, AppLogger::Level level)
{
    appendLine(line, level);
}

void LogPanelWidget::onClearClicked()
{
    m_view->clear();
    AppLogger::instance().info(QStringLiteral("LogUI"), QStringLiteral("已清空界面显示（文件日志保留）"));
}

void LogPanelWidget::onOpenFolderClicked()
{
    QDesktopServices::openUrl(QUrl::fromLocalFile(AppLogger::instance().logDirectory()));
}

void LogPanelWidget::onLevelFilterChanged(int index)
{
    Q_UNUSED(index);
    m_filterMin = static_cast<AppLogger::Level>(m_levelFilter->currentData().toInt());

    m_view->clear();
    const auto &logger = AppLogger::instance();
    for (const QString &line : logger.recentLines()) {
        AppLogger::Level level = AppLogger::Level::Info;
        if (line.contains(QStringLiteral("[DEBUG]")))
            level = AppLogger::Level::Debug;
        else if (line.contains(QStringLiteral("[WARN]")))
            level = AppLogger::Level::Warn;
        else if (line.contains(QStringLiteral("[ERROR]")))
            level = AppLogger::Level::Error;
        appendLine(line, level);
    }
}

void LogPanelWidget::onFetchServerLogsClicked()
{
    QString base;
    if (!checkServerUrl(&base))
        return;

    m_fetchServerLogsBtn->setEnabled(false);
    AppLogger::instance().info(QStringLiteral("LogUI"), QStringLiteral("GET %1/api/logs").arg(base));

    QNetworkRequest netRequest;
    netRequest.setUrl(QUrl(base + QStringLiteral("/api/logs")));
    QNetworkReply *reply = mainWindow()->networkManager()->get(netRequest);
    reply->setProperty(kRequestKind, static_cast<int>(RequestKind::ListServerLogs));
    reply->setProperty(kOwnerPanel, reinterpret_cast<quintptr>(this));
}

void LogPanelWidget::onOpenServerLogClicked()
{
    const QListWidgetItem *item = m_serverLogList->currentItem();
    if (!item) {
        QMessageBox::warning(this, QStringLiteral("提示"), QStringLiteral("请先选择一条后端日志"));
        return;
    }

    const QString name = item->data(Qt::UserRole).toString();
    QString base;
    if (!checkServerUrl(&base))
        return;

    m_openServerLogBtn->setEnabled(false);
    const QString downloadUrl = base + QStringLiteral("/api/logs/download?name=")
                                + QString::fromUtf8(QUrl::toPercentEncoding(name));
    AppLogger::instance().info(QStringLiteral("LogUI"), QStringLiteral("下载后端日志：%1").arg(name));

    QNetworkRequest netRequest;
    netRequest.setUrl(QUrl(downloadUrl));
    QNetworkReply *reply = mainWindow()->networkManager()->get(netRequest);
    reply->setProperty(kRequestKind, static_cast<int>(RequestKind::DownloadServerLog));
    reply->setProperty(kOwnerPanel, reinterpret_cast<quintptr>(this));
    reply->setProperty("logFileName", name);
}

void LogPanelWidget::onNetworkReplyFinished(QNetworkReply *reply)
{
    if (reply->property(kOwnerPanel).toULongLong() != reinterpret_cast<quintptr>(this))
        return;

    const auto kind = static_cast<RequestKind>(reply->property(kRequestKind).toInt());
    reply->deleteLater();

    if (kind == RequestKind::ListServerLogs)
        m_fetchServerLogsBtn->setEnabled(true);
    else
        m_openServerLogBtn->setEnabled(m_serverLogList->currentItem() != nullptr);

    if (reply->error() != QNetworkReply::NoError) {
        AppLogger::instance().error(QStringLiteral("LogUI"), reply->errorString());
        QMessageBox::critical(this, QStringLiteral("网络错误"), reply->errorString());
        return;
    }

    const QByteArray body = reply->readAll();

    if (kind == RequestKind::ListServerLogs) {
        QJsonParseError err;
        const QJsonDocument doc = QJsonDocument::fromJson(body, &err);
        if (err.error != QJsonParseError::NoError || !doc.isObject()) {
            QMessageBox::warning(this, QStringLiteral("解析失败"), QStringLiteral("无法解析后端响应"));
            return;
        }

        const QJsonObject obj = doc.object();
        if (!obj.value(QStringLiteral("ok")).toBool()) {
            QMessageBox::critical(this, QStringLiteral("失败"),
                                  obj.value(QStringLiteral("error")).toString());
            return;
        }

        m_serverLogList->clear();
        const QJsonArray files = obj.value(QStringLiteral("files")).toArray();
        for (const QJsonValue &v : files) {
            const QJsonObject f = v.toObject();
            const QString name = f.value(QStringLiteral("name")).toString();
            const qint64 size = static_cast<qint64>(f.value(QStringLiteral("size")).toDouble());
            const QString modified = f.value(QStringLiteral("modified_at")).toString();
            const QString line = QStringLiteral("%1  (%2, %3)")
                                     .arg(name, formatFileSize(size), modified);
            auto *item = new QListWidgetItem(line, m_serverLogList);
            item->setData(Qt::UserRole, name);
        }

        const QString dir = obj.value(QStringLiteral("dir")).toString();
        AppLogger::instance().info(
            QStringLiteral("LogUI"),
            QStringLiteral("后端日志 %1 个，目录：%2").arg(files.size()).arg(dir));
        if (files.isEmpty()) {
            QMessageBox::information(this, QStringLiteral("提示"), QStringLiteral("后端日志目录为空。"));
        }
        return;
    }

    if (kind == RequestKind::DownloadServerLog) {
        const QString name = reply->property("logFileName").toString();
        if (name.isEmpty()) {
            QMessageBox::warning(this, QStringLiteral("失败"), QStringLiteral("文件名为空"));
            return;
        }

        const QString savePath = serverLogCacheDir() + QLatin1Char('/') + name;
        QFile file(savePath);
        if (!file.open(QIODevice::WriteOnly)) {
            QMessageBox::critical(this, QStringLiteral("保存失败"), file.errorString());
            return;
        }
        file.write(body);
        file.close();

        AppLogger::instance().info(QStringLiteral("LogUI"),
                                   QStringLiteral("已保存后端日志：%1").arg(savePath));
        if (!QDesktopServices::openUrl(QUrl::fromLocalFile(savePath))) {
            QMessageBox::information(this, QStringLiteral("已下载"),
                                   QStringLiteral("文件已保存至：\n%1").arg(savePath));
        }
    }
}
