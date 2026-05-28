#ifndef PROJECTPANELWIDGET_H
#define PROJECTPANELWIDGET_H

#include <QWidget>

class MainWindow;
class QLabel;
class QListWidget;
class QPushButton;
class QTableWidget;
class QNetworkReply;
class QJsonArray;
class QJsonObject;

class ProjectPanelWidget : public QWidget
{
    Q_OBJECT

public:
    explicit ProjectPanelWidget(QWidget *parent = nullptr);

private slots:
    void onRefreshMembersClicked();
    void onSendNotifyClicked();
    void onReplyFinished(QNetworkReply *reply);

private:
    enum class RequestKind { LoadUsers, SendNotify };

    MainWindow *mainWindow() const;
    bool checkServerUrl(QString *baseOut = nullptr);
    void startGet(const QString &path, RequestKind kind);
    void startPost(const QString &path, RequestKind kind, const QByteArray &body);
    void setBusy(bool busy);
    void setStatus(const QString &text);
    void showMembers(const QJsonArray &users);
    void setupProjectTable();
    QString selectedMemberUserId() const;
    QString selectedMemberName() const;

    QLabel *m_statusLabel = nullptr;
    QLabel *m_memberCountLabel = nullptr;
    QListWidget *m_memberList = nullptr;
    QTableWidget *m_projectTable = nullptr;
    QPushButton *m_refreshBtn = nullptr;
    QPushButton *m_sendBtn = nullptr;
};

#endif // PROJECTPANELWIDGET_H
