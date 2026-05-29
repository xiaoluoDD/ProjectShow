#include "appstyle.h"

#include <QApplication>
#include <QFont>
#include <QStyle>
#include <QStyleFactory>

namespace {

QString industrialStylesheet()
{
    return QStringLiteral(R"(
/* —— 工业 HMI / 项目看板 —— */
QWidget {
    background-color: #2a2f36;
    color: #dce1e8;
    font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif;
    font-size: 9pt;
    selection-background-color: #3d8fd1;
    selection-color: #ffffff;
}

QMainWindow {
    background-color: #23272e;
}

/* 顶栏：后端地址 */
QFrame#serverBar {
    background-color: #1e2228;
    border: 1px solid #3d4553;
    border-radius: 4px;
    padding: 4px 8px;
}

QLabel#serverBarLabel {
    color: #9aa3b2;
    font-weight: 600;
    padding-right: 6px;
}

QLineEdit#serverUrlEdit {
    background-color: #353b43;
    color: #eef1f5;
    border: 1px solid #4a5568;
    border-radius: 3px;
    padding: 6px 10px;
    min-height: 22px;
}

QLineEdit#serverUrlEdit:focus {
    border-color: #3d8fd1;
}

/* 一级标签 */
QTabWidget#mainTabWidget::pane {
    border: 1px solid #3d4553;
    border-top: 2px solid #3d8fd1;
    background: #2a2f36;
    border-radius: 0 0 4px 4px;
    top: -1px;
}

QTabWidget#mainTabWidget > QTabBar::tab {
    background: #353b43;
    color: #9aa3b2;
    border: 1px solid #3d4553;
    border-bottom: none;
    padding: 8px 20px;
    margin-right: 2px;
    min-width: 88px;
}

QTabWidget#mainTabWidget > QTabBar::tab:selected {
    background: #2a2f36;
    color: #3d8fd1;
    font-weight: 600;
    border-top: 2px solid #3d8fd1;
}

QTabWidget#mainTabWidget > QTabBar::tab:hover:!selected {
    background: #3d4553;
    color: #dce1e8;
}

/* 调试二级标签 */
QTabWidget#debugSubTabs::pane {
    border: 1px solid #3d4553;
    background: #2a2f36;
    border-radius: 4px;
}

QTabWidget#debugSubTabs > QTabBar::tab {
    background: #2f3540;
    color: #9aa3b2;
    border: 1px solid #3d4553;
    padding: 6px 14px;
    margin-right: 2px;
}

QTabWidget#debugSubTabs > QTabBar::tab:selected {
    background: #3d8fd1;
    color: #ffffff;
    font-weight: 600;
}

/* 页面标题与说明 */
QLabel#pageTitle {
    font-size: 16pt;
    font-weight: 700;
    color: #eef1f5;
    padding: 2px 0 6px 0;
    border-bottom: 2px solid #3d8fd1;
    margin-bottom: 4px;
}

QLabel#pageHint {
    color: #9aa3b2;
    font-size: 9pt;
}

QLabel#accentText {
    color: #5eb3ff;
    font-weight: 600;
    padding: 2px 0;
}

QLabel#sectionTitle {
    color: #c5cdd8;
    font-weight: 600;
    font-size: 10pt;
    padding-top: 6px;
}

/* 按钮 */
QPushButton {
    background-color: #353b43;
    color: #dce1e8;
    border: 1px solid #4a5568;
    border-radius: 3px;
    padding: 6px 14px;
    min-height: 24px;
}

QPushButton:hover {
    background-color: #3d4553;
    border-color: #5a6578;
}

QPushButton:pressed {
    background-color: #2a2f36;
}

QPushButton:disabled {
    color: #6b7280;
    background-color: #2f3540;
    border-color: #3d4553;
}

QPushButton#btnPrimary {
    background-color: #2d4a6a;
    border-color: #3d8fd1;
    color: #e8f4ff;
    font-weight: 600;
}

QPushButton#btnPrimary:hover {
    background-color: #3d8fd1;
    color: #ffffff;
}

QPushButton#btnAction {
    background-color: #3d4a2a;
    border-color: #8fad3c;
    color: #eef5dc;
    font-weight: 600;
    padding: 8px 18px;
}

QPushButton#btnAction:hover {
    background-color: #5a7a2e;
    border-color: #a8c94e;
}

QPushButton#btnDanger {
    background-color: #4a2d2d;
    border-color: #c45c5c;
    color: #ffe8e8;
}

QPushButton#btnDanger:hover {
    background-color: #8b3a3a;
    border-color: #e07070;
}

/* 表格 */
QTableWidget, QTableView {
    background-color: #353b43;
    alternate-background-color: #2f3540;
    gridline-color: #3d4553;
    border: 1px solid #4a5568;
    border-radius: 3px;
}

QTableWidget::item, QTableView::item {
    padding: 4px 6px;
    border: none;
}

QTableWidget::item:selected, QTableView::item:selected {
    background-color: #2d5a87;
    color: #ffffff;
}

QHeaderView::section {
    background-color: #1e2228;
    color: #b8c0cc;
    padding: 6px 8px;
    border: none;
    border-right: 1px solid #3d4553;
    border-bottom: 2px solid #3d8fd1;
    font-weight: 600;
}

/* 列表 */
QListWidget {
    background-color: #353b43;
    border: 1px solid #4a5568;
    border-radius: 3px;
    outline: none;
}

QListWidget::item {
    padding: 5px 8px;
    border-bottom: 1px solid #3d4553;
}

QListWidget::item:selected {
    background-color: #2d5a87;
    color: #ffffff;
}

QListWidget::item:hover:!selected {
    background-color: #3d4553;
}

/* 文本框 / 日志 */
QPlainTextEdit#logView,
QPlainTextEdit#dataPreview {
    background-color: #1e2228;
    color: #c8d0da;
    border: 1px solid #4a5568;
    border-radius: 3px;
    font-family: Consolas, "Cascadia Mono", monospace;
    font-size: 9pt;
    padding: 6px;
}

/* 下拉 */
QComboBox {
    background-color: #353b43;
    color: #dce1e8;
    border: 1px solid #4a5568;
    border-radius: 3px;
    padding: 4px 8px;
    min-height: 22px;
}

QComboBox::drop-down {
    border: none;
    width: 20px;
}

QComboBox QAbstractItemView {
    background-color: #353b43;
    color: #dce1e8;
    selection-background-color: #3d8fd1;
    border: 1px solid #4a5568;
}

/* 对话框 */
QDialog {
    background-color: #2a2f36;
}

QDialog QLabel {
    color: #dce1e8;
}

QDialog QLineEdit, QDialog QTextEdit, QDialog QComboBox {
    background-color: #353b43;
    color: #eef1f5;
    border: 1px solid #4a5568;
    border-radius: 3px;
    padding: 4px 6px;
}

QDialogButtonBox QPushButton {
    min-width: 72px;
}

/* 滚动条 */
QScrollBar:vertical {
    background: #2a2f36;
    width: 10px;
    margin: 0;
}

QScrollBar::handle:vertical {
    background: #4a5568;
    border-radius: 4px;
    min-height: 24px;
}

QScrollBar::handle:vertical:hover {
    background: #5a6578;
}

QScrollBar:horizontal {
    background: #2a2f36;
    height: 10px;
}

QScrollBar::handle:horizontal {
    background: #4a5568;
    border-radius: 4px;
    min-width: 24px;
}

QScrollBar::add-line, QScrollBar::sub-line {
    width: 0;
    height: 0;
}

/* 分割条 */
QSplitter::handle {
    background-color: #3d4553;
}

QMessageBox {
    background-color: #2a2f36;
}

QMessageBox QLabel {
    color: #dce1e8;
}
)");
}

} // namespace

void AppStyle::apply(QApplication &app)
{
    if (QStyle *fusion = QStyleFactory::create(QStringLiteral("Fusion")))
        app.setStyle(fusion);

    QFont uiFont(QStringLiteral("Microsoft YaHei UI"), 9);
    if (!uiFont.exactMatch()) {
        uiFont = QFont(QStringLiteral("Segoe UI"), 9);
    }
    app.setFont(uiFont);

    app.setStyleSheet(industrialStylesheet());
}
