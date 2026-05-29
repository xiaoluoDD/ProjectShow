#ifndef MEMBERPANELWIDGET_H
#define MEMBERPANELWIDGET_H

#include <QWidget>

class MainWindow;
class QLabel;
class QPushButton;
class QTableWidget;
class QNetworkReply;
class QJsonArray;

namespace MemberPanelRequests {
enum class Kind { Sync, LoadUsers };
}

class MemberPanelWidget : public QWidget
{
    Q_OBJECT

public:
    explicit MemberPanelWidget(QWidget *parent = nullptr);

private slots:
    void onSyncClicked();
    void onRefreshClicked();
    void onSelectionChanged();
    void onReplyFinished(QNetworkReply *reply);

private:
    MainWindow *mainWindow() const;
    bool checkServerUrl(QString *baseOut = nullptr);
    void startGet(const QString &path, MemberPanelRequests::Kind kind);
    void startPost(const QString &path, MemberPanelRequests::Kind kind);
    void setBusy(bool busy);
    void showMembers(const QJsonArray &users);
    void applyRowSelection(int row);

    QLabel *m_hintLabel = nullptr;
    QLabel *m_countLabel = nullptr;
    QTableWidget *m_table = nullptr;
    QPushButton *m_syncBtn = nullptr;
    QPushButton *m_refreshBtn = nullptr;
};

#endif // MEMBERPANELWIDGET_H
