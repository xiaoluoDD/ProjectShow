#ifndef DATAPANELWIDGET_H
#define DATAPANELWIDGET_H

#include <QWidget>

class MainWindow;
class QLabel;
class QListWidget;
class QPlainTextEdit;
class QPushButton;
class QNetworkReply;

class DataPanelWidget : public QWidget
{
    Q_OBJECT

public:
    explicit DataPanelWidget(QWidget *parent = nullptr);

private slots:
    void onFetchAndSaveClicked();
    void onDownloadDbClicked();
    void onRefreshListClicked();
    void onOpenDirClicked();
    void onSnapshotSelectionChanged();
    void onReplyFinished(QNetworkReply *reply);

private:
    MainWindow *mainWindow() const;
    bool checkServerUrl(QString *baseOut = nullptr);
    void setBusy(bool busy);
    void refreshSnapshotList();
    void showSnapshotFile(const QString &path, const QString &kind = QStringLiteral("json"));
    void setStatus(const QString &text);

    QLabel *m_statusLabel = nullptr;
    QPushButton *m_fetchBtn = nullptr;
    QPushButton *m_downloadDbBtn = nullptr;
    QPushButton *m_refreshBtn = nullptr;
    QPushButton *m_openDirBtn = nullptr;
    QListWidget *m_snapshotList = nullptr;
    QPlainTextEdit *m_preview = nullptr;
};

#endif // DATAPANELWIDGET_H
