#ifndef DEBUGPANELWIDGET_H
#define DEBUGPANELWIDGET_H

#include <QWidget>

class MainWindow;
class QListWidget;
class QPushButton;
class QNetworkReply;
class QJsonArray;
class QJsonObject;

namespace DebugPanelRequests {
enum class Kind { Ping, WecomTest, WecomSync, WecomUsers, WecomStats };
}

class DebugPanelWidget : public QWidget
{
    Q_OBJECT

public:
    explicit DebugPanelWidget(QWidget *parent = nullptr);

private slots:
    void onPingClicked();
    void onSendTestClicked();
    void onSyncClicked();
    void onUsersClicked();
    void onStatsClicked();
    void onReplyFinished(QNetworkReply *reply);

private:
    MainWindow *mainWindow() const;
    bool checkServerUrl(QString *baseOut = nullptr);
    void startGet(const QString &path, DebugPanelRequests::Kind kind);
    void startPost(const QString &path, DebugPanelRequests::Kind kind,
                  const QByteArray &body = QByteArray("{}"));
    void logInfo(const QString &message) const;
    void logWarn(const QString &message) const;
    void logError(const QString &message) const;
    void setButtonsEnabled(bool enabled);
    void showMembers(const QJsonArray &users, int count);
    void handleJsonError(const QJsonObject &obj, const QString &title);
    QString selectedMemberUserId() const;
    QString selectedMemberName() const;

    QPushButton *m_pingBtn = nullptr;
    QPushButton *m_sendTestBtn = nullptr;
    QPushButton *m_syncBtn = nullptr;
    QPushButton *m_usersBtn = nullptr;
    QPushButton *m_statsBtn = nullptr;
    QListWidget *m_memberList = nullptr;
};

#endif // DEBUGPANELWIDGET_H
