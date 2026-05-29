#ifndef LOGPANELWIDGET_H
#define LOGPANELWIDGET_H

#include "applogger.h"

#include <QWidget>

class MainWindow;
class QComboBox;
class QListWidget;
class QPlainTextEdit;
class QPushButton;
class QNetworkReply;

namespace LogPanelRequests {
enum class Kind { ListServerLogs, DownloadServerLog };
}

class LogPanelWidget : public QWidget
{
    Q_OBJECT

public:
    explicit LogPanelWidget(QWidget *parent = nullptr);

private slots:
    void onLogRecorded(const QString &line, AppLogger::Level level);
    void onClearClicked();
    void onOpenFolderClicked();
    void onLevelFilterChanged(int index);
    void onFetchServerLogsClicked();
    void onOpenServerLogClicked();
    void onNetworkReplyFinished(QNetworkReply *reply);

private:
    MainWindow *mainWindow() const;
    bool checkServerUrl(QString *baseOut = nullptr);
    void appendLine(const QString &line, AppLogger::Level level);
    bool passFilter(AppLogger::Level level) const;
    QString serverLogCacheDir() const;

    QPlainTextEdit *m_view = nullptr;
    QComboBox *m_levelFilter = nullptr;
    QPushButton *m_clearBtn = nullptr;
    QPushButton *m_openFolderBtn = nullptr;
    QPushButton *m_fetchServerLogsBtn = nullptr;
    QPushButton *m_openServerLogBtn = nullptr;
    QListWidget *m_serverLogList = nullptr;
    AppLogger::Level m_filterMin = AppLogger::Level::Debug;
};

#endif // LOGPANELWIDGET_H
