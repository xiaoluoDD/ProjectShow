#include "datapanelwidget.h"

#include "applogger.h"
#include "localdatastore.h"
#include "mainwindow.h"

#include <QDesktopServices>
#include <QDir>
#include <QFileInfo>
#include <QHBoxLayout>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QListWidget>
#include <QMessageBox>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QSettings>
#include <QSplitter>
#include <QUrl>
#include <QVBoxLayout>

namespace {

const char kRequestKind[] = "requestKind";
const char kOwnerPanel[] = "ownerPanel";

enum class RequestKind { DbExport, DbDownload };

} // namespace

DataPanelWidget::DataPanelWidget(QWidget *parent)
    : QWidget(parent)
{
    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(0, 8, 0, 0);

    auto *title = new QLabel(QStringLiteral("本地数据"), this);
    title->setObjectName(QStringLiteral("pageTitle"));
    root->addWidget(title);

    auto *hint = new QLabel(
        QStringLiteral("从后端拉取数据到本地：JSON 快照便于阅读，.db 文件可用 DB Browser for SQLite 等工具打开。"),
        this);
    hint->setObjectName(QStringLiteral("pageHint"));
    hint->setWordWrap(true);
    root->addWidget(hint);

    m_statusLabel = new QLabel(
        QStringLiteral("本地目录：%1").arg(LocalDataStore::dataDirectory()), this);
    m_statusLabel->setObjectName(QStringLiteral("accentText"));
    m_statusLabel->setWordWrap(true);
    root->addWidget(m_statusLabel);

    auto *tool = new QHBoxLayout;
    m_fetchBtn = new QPushButton(QStringLiteral("拉取 JSON 快照"), this);
    m_downloadDbBtn = new QPushButton(QStringLiteral("下载数据库 (.db)"), this);
    m_downloadDbBtn->setObjectName(QStringLiteral("btnPrimary"));
    m_refreshBtn = new QPushButton(QStringLiteral("刷新本地列表"), this);
    m_openDirBtn = new QPushButton(QStringLiteral("打开本地目录"), this);
    tool->addWidget(m_fetchBtn);
    tool->addWidget(m_downloadDbBtn);
    tool->addWidget(m_refreshBtn);
    tool->addWidget(m_openDirBtn);
    tool->addStretch();
    root->addLayout(tool);

    auto *split = new QSplitter(Qt::Horizontal, this);
    m_snapshotList = new QListWidget(split);
    m_snapshotList->setObjectName(QStringLiteral("dataList"));
    m_snapshotList->setMinimumWidth(220);
    m_preview = new QPlainTextEdit(split);
    m_preview->setObjectName(QStringLiteral("dataPreview"));
    m_preview->setReadOnly(true);
    m_preview->setPlaceholderText(QStringLiteral("选择左侧快照，或点击「从后端拉取并保存」"));
    split->addWidget(m_snapshotList);
    split->addWidget(m_preview);
    split->setStretchFactor(0, 0);
    split->setStretchFactor(1, 1);
    root->addWidget(split, 1);

    connect(m_fetchBtn, &QPushButton::clicked, this, &DataPanelWidget::onFetchAndSaveClicked);
    connect(m_downloadDbBtn, &QPushButton::clicked, this, &DataPanelWidget::onDownloadDbClicked);
    connect(m_refreshBtn, &QPushButton::clicked, this, &DataPanelWidget::onRefreshListClicked);
    connect(m_openDirBtn, &QPushButton::clicked, this, &DataPanelWidget::onOpenDirClicked);
    connect(m_snapshotList, &QListWidget::currentRowChanged, this,
            &DataPanelWidget::onSnapshotSelectionChanged);
    connect(mainWindow()->networkManager(), &QNetworkAccessManager::finished, this,
            &DataPanelWidget::onReplyFinished);

    LocalDataStore::ensureDataDirectory();
    refreshSnapshotList();
}

MainWindow *DataPanelWidget::mainWindow() const
{
    return qobject_cast<MainWindow *>(window());
}

void DataPanelWidget::setStatus(const QString &text)
{
    m_statusLabel->setText(text);
}

bool DataPanelWidget::checkServerUrl(QString *baseOut)
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

void DataPanelWidget::setBusy(bool busy)
{
    m_fetchBtn->setEnabled(!busy);
    m_downloadDbBtn->setEnabled(!busy);
    m_refreshBtn->setEnabled(!busy);
    m_openDirBtn->setEnabled(!busy);
    m_snapshotList->setEnabled(!busy);
}

void DataPanelWidget::refreshSnapshotList()
{
    m_snapshotList->clear();

    const QString latest = LocalDataStore::latestSnapshotPath();
    if (QFileInfo::exists(latest)) {
        auto *latestItem = new QListWidgetItem(QStringLiteral("最新 (snapshot-latest.json)"), m_snapshotList);
        latestItem->setData(Qt::UserRole, latest);
        latestItem->setData(Qt::UserRole + 1, QStringLiteral("json"));
        latestItem->setToolTip(latest);
    }

    const QString latestDb = LocalDataStore::dataDirectory() + QStringLiteral("/wecom-latest.db");
    if (QFileInfo::exists(latestDb)) {
        auto *dbItem = new QListWidgetItem(QStringLiteral("最新数据库 (wecom-latest.db)"), m_snapshotList);
        dbItem->setData(Qt::UserRole, latestDb);
        dbItem->setData(Qt::UserRole + 1, QStringLiteral("db"));
        dbItem->setToolTip(latestDb);
    }

    const QStringList files = LocalDataStore::listSnapshots();
    for (const QString &path : files) {
        auto *item = new QListWidgetItem(QFileInfo(path).fileName(), m_snapshotList);
        item->setData(Qt::UserRole, path);
        item->setData(Qt::UserRole + 1, QStringLiteral("json"));
        item->setToolTip(path);
    }

    const QStringList dbFiles = LocalDataStore::listDatabaseFiles();
    for (const QString &path : dbFiles) {
        auto *item = new QListWidgetItem(QFileInfo(path).fileName(), m_snapshotList);
        item->setData(Qt::UserRole, path);
        item->setData(Qt::UserRole + 1, QStringLiteral("db"));
        item->setToolTip(path);
    }

    if (m_snapshotList->count() > 0)
        m_snapshotList->setCurrentRow(0);
    else
        m_preview->clear();
}

void DataPanelWidget::showSnapshotFile(const QString &path, const QString &kind)
{
    if (kind == QStringLiteral("db")) {
        const QFileInfo info(path);
        m_preview->setPlainText(
            QStringLiteral("SQLite 数据库文件\n路径：%1\n大小：%2 字节\n\n请用 DB Browser for SQLite 等工具打开。")
                .arg(path, QString::number(info.size())));
        return;
    }

    QJsonObject root;
    QString err;
    if (!LocalDataStore::readSnapshot(path, &root, &err)) {
        m_preview->setPlainText(QStringLiteral("无法读取：%1\n%2").arg(path, err));
        return;
    }

    const QString summary = LocalDataStore::buildSummaryText(root);
    const QString json = QString::fromUtf8(
        QJsonDocument(root).toJson(QJsonDocument::Indented));
    m_preview->setPlainText(summary + QStringLiteral("\n\n======== JSON ========\n\n") + json);
}

void DataPanelWidget::onRefreshListClicked()
{
    refreshSnapshotList();
    setStatus(QStringLiteral("本地目录：%1").arg(LocalDataStore::dataDirectory()));
}

void DataPanelWidget::onOpenDirClicked()
{
    LocalDataStore::ensureDataDirectory();
    const QString dir = LocalDataStore::dataDirectory();
    if (!QDesktopServices::openUrl(QUrl::fromLocalFile(dir))) {
        QMessageBox::warning(this, QStringLiteral("提示"),
                             QStringLiteral("无法打开目录：%1").arg(dir));
    }
}

void DataPanelWidget::onSnapshotSelectionChanged()
{
    const QListWidgetItem *item = m_snapshotList->currentItem();
    if (!item)
        return;
    showSnapshotFile(item->data(Qt::UserRole).toString(),
                     item->data(Qt::UserRole + 1).toString());
}

void DataPanelWidget::onDownloadDbClicked()
{
    QString base;
    if (!checkServerUrl(&base))
        return;

    setBusy(true);
    setStatus(QStringLiteral("正在下载数据库文件 …"));

    QNetworkRequest netRequest;
    netRequest.setUrl(QUrl(base + QStringLiteral("/api/db/download")));
    QNetworkReply *reply = mainWindow()->networkManager()->get(netRequest);
    reply->setProperty(kRequestKind, static_cast<int>(RequestKind::DbDownload));
    reply->setProperty(kOwnerPanel, reinterpret_cast<quintptr>(this));
}

void DataPanelWidget::onFetchAndSaveClicked()
{
    QString base;
    if (!checkServerUrl(&base))
        return;

    setBusy(true);
    setStatus(QStringLiteral("正在从后端拉取数据 …"));

    QNetworkRequest netRequest;
    netRequest.setUrl(QUrl(base + QStringLiteral("/api/db/export")));
    QNetworkReply *reply = mainWindow()->networkManager()->get(netRequest);
    reply->setProperty(kRequestKind, static_cast<int>(RequestKind::DbExport));
    reply->setProperty(kOwnerPanel, reinterpret_cast<quintptr>(this));
}

void DataPanelWidget::onReplyFinished(QNetworkReply *reply)
{
    if (reply->property(kOwnerPanel).toULongLong() != reinterpret_cast<quintptr>(this))
        return;

    const auto kind = static_cast<RequestKind>(reply->property(kRequestKind).toInt());

    reply->deleteLater();
    setBusy(false);

    if (reply->error() != QNetworkReply::NoError) {
        setStatus(QStringLiteral("请求失败：%1").arg(reply->errorString()));
        QMessageBox::critical(this, QStringLiteral("网络错误"), reply->errorString());
        return;
    }

    const QByteArray body = reply->readAll();

    if (kind == RequestKind::DbDownload) {
        if (body.startsWith('{')) {
            QJsonParseError parseErr;
            const QJsonDocument doc = QJsonDocument::fromJson(body, &parseErr);
            if (parseErr.error == QJsonParseError::NoError && doc.isObject()) {
                const QString err = doc.object().value(QStringLiteral("error")).toString(
                    QStringLiteral("下载失败"));
                setStatus(QStringLiteral("下载失败：%1").arg(err));
                QMessageBox::critical(this, QStringLiteral("下载失败"), err);
                return;
            }
        }

        const QString savedPath = LocalDataStore::saveDatabaseFile(body);
        if (savedPath.isEmpty()) {
            setStatus(QStringLiteral("保存失败：%1").arg(LocalDataStore::dataDirectory()));
            QMessageBox::critical(this, QStringLiteral("保存失败"),
                                  QStringLiteral("无法写入本地目录"));
            return;
        }

        const QString msg = QStringLiteral("已保存 %1（%2 字节）")
                                .arg(QFileInfo(savedPath).fileName(),
                                     QString::number(body.size()));
        AppLogger::instance().info(QStringLiteral("Data"), msg);
        setStatus(QStringLiteral("本地目录：%1 | %2").arg(LocalDataStore::dataDirectory(), msg));
        refreshSnapshotList();
        QMessageBox::information(this, QStringLiteral("下载成功"), msg);
        return;
    }

    QJsonParseError parseErr;
    const QJsonDocument doc = QJsonDocument::fromJson(body, &parseErr);
    if (parseErr.error != QJsonParseError::NoError || !doc.isObject()) {
        setStatus(QStringLiteral("响应解析失败"));
        QMessageBox::warning(this, QStringLiteral("解析失败"), QStringLiteral("响应不是合法 JSON"));
        return;
    }

    const QJsonObject obj = doc.object();
    if (!obj.value(QStringLiteral("ok")).toBool(false)) {
        const QString err = obj.value(QStringLiteral("error")).toString();
        setStatus(QStringLiteral("拉取失败：%1").arg(err));
        QMessageBox::critical(this, QStringLiteral("拉取失败"), err);
        return;
    }

    const QString savedPath = LocalDataStore::saveSnapshot(obj);
    if (savedPath.isEmpty()) {
        setStatus(QStringLiteral("保存失败，请检查目录权限：%1").arg(LocalDataStore::dataDirectory()));
        QMessageBox::critical(this, QStringLiteral("保存失败"),
                              QStringLiteral("无法写入 %1").arg(LocalDataStore::dataDirectory()));
        return;
    }

    const QJsonObject count = obj.value(QStringLiteral("count")).toObject();
    const QString msg =
        QStringLiteral("已保存：%1\n成员 %2 人，项目 %3 条")
            .arg(QFileInfo(savedPath).fileName(),
                 QString::number(count.value(QStringLiteral("users")).toInt()),
                 QString::number(count.value(QStringLiteral("projects")).toInt()));

    AppLogger::instance().info(QStringLiteral("Data"), msg);
    setStatus(QStringLiteral("本地目录：%1 | %2").arg(LocalDataStore::dataDirectory(), msg));
    refreshSnapshotList();

    for (int i = 0; i < m_snapshotList->count(); ++i) {
        if (m_snapshotList->item(i)->data(Qt::UserRole).toString() == savedPath) {
            m_snapshotList->setCurrentRow(i);
            break;
        }
    }

    QMessageBox::information(this, QStringLiteral("保存成功"), msg);
}
