#include "appstyle.h"

#include <QApplication>
#include <QFont>
#include <QStyle>
#include <QStyleFactory>

namespace {

QString industrialStylesheet()
{
    return QStringLiteral(R"(
/* —— 项目看板 · 浅色主题 —— */
QWidget {
    background-color: #eef1f6;
    color: #2c3340;
    font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif;
    font-size: 9pt;
    selection-background-color: #4a9ae8;
    selection-color: #ffffff;
}

QMainWindow {
    background-color: #e4e8ef;
}

/* 顶栏：后端地址 */
QFrame#serverBar {
    background-color: #ffffff;
    border: 1px solid #c8d0dc;
    border-radius: 4px;
    padding: 4px 8px;
}

QLabel#serverBarLabel {
    color: #5a6578;
    font-weight: 600;
    padding-right: 6px;
}

QLineEdit#serverUrlEdit {
    background-color: #ffffff;
    color: #2c3340;
    border: 1px solid #b8c2d0;
    border-radius: 3px;
    padding: 6px 10px;
    min-height: 22px;
}

QLineEdit#serverUrlEdit:focus {
    border-color: #4a9ae8;
}

/* 一级标签 */
QTabWidget#mainTabWidget::pane {
    border: 1px solid #c8d0dc;
    border-top: 2px solid #4a9ae8;
    background: #ffffff;
    border-radius: 0 0 4px 4px;
    top: -1px;
}

QTabWidget#mainTabWidget > QTabBar::tab {
    background: #dce2eb;
    color: #5a6578;
    border: 1px solid #c8d0dc;
    border-bottom: none;
    padding: 8px 20px;
    margin-right: 2px;
    min-width: 88px;
}

QTabWidget#mainTabWidget > QTabBar::tab:selected {
    background: #ffffff;
    color: #2563b8;
    font-weight: 600;
    border-top: 2px solid #4a9ae8;
}

QTabWidget#mainTabWidget > QTabBar::tab:hover:!selected {
    background: #e8edf4;
    color: #2c3340;
}

/* 调试二级标签 */
QTabWidget#debugSubTabs::pane {
    border: 1px solid #c8d0dc;
    background: #f5f7fa;
    border-radius: 4px;
}

QTabWidget#debugSubTabs > QTabBar::tab {
    background: #e4e9f0;
    color: #5a6578;
    border: 1px solid #c8d0dc;
    padding: 6px 14px;
    margin-right: 2px;
}

QTabWidget#debugSubTabs > QTabBar::tab:selected {
    background: #4a9ae8;
    color: #ffffff;
    font-weight: 600;
}

/* 页面标题与说明 */
QLabel#pageTitle {
    font-size: 16pt;
    font-weight: 700;
    color: #1e2936;
    padding: 2px 0 6px 0;
    border-bottom: 2px solid #4a9ae8;
    margin-bottom: 4px;
}

QLabel#pageHint {
    color: #6b7788;
    font-size: 9pt;
}

QLabel#accentText {
    color: #2563b8;
    font-weight: 600;
    padding: 2px 0;
}

QLabel#sectionTitle {
    color: #3d4a5c;
    font-weight: 600;
    font-size: 10pt;
    padding-top: 6px;
}

/* 按钮 */
QPushButton {
    background-color: #ffffff;
    color: #2c3340;
    border: 1px solid #b8c2d0;
    border-radius: 3px;
    padding: 6px 14px;
    min-height: 24px;
}

QPushButton:hover {
    background-color: #e8edf4;
    border-color: #9aa8bc;
}

QPushButton:pressed {
    background-color: #dce2eb;
}

QPushButton:disabled {
    color: #9aa3b2;
    background-color: #eef1f6;
    border-color: #d0d7e2;
}

QPushButton#btnPrimary {
    background-color: #4a9ae8;
    border-color: #3a8ad8;
    color: #ffffff;
    font-weight: 600;
}

QPushButton#btnPrimary:hover {
    background-color: #3a8ad8;
    border-color: #2d7ac8;
}

QPushButton#btnAction {
    background-color: #eef6dc;
    border-color: #9cbd4a;
    color: #3d5020;
    font-weight: 600;
    padding: 8px 18px;
}

QPushButton#btnAction:hover {
    background-color: #dfecc4;
    border-color: #7fa838;
}

QPushButton#btnDanger {
    background-color: #fdeaea;
    border-color: #e07070;
    color: #8b2020;
}

QPushButton#btnDanger:hover {
    background-color: #f8d0d0;
    border-color: #c85050;
}

/* 表格 */
QTableWidget, QTableView {
    background-color: #ffffff;
    alternate-background-color: #f4f7fb;
    gridline-color: #d8dfe8;
    border: 1px solid #c8d0dc;
    border-radius: 3px;
}

/* 日历内嵌表格勿套用数据表边框/内边距，否则日期数字会被挤成 ... */
QCalendarWidget QTableView {
    border: none;
    border-radius: 0;
    background-color: #ffffff;
}

QCalendarWidget QTableView::item {
    min-width: 36px;
    min-height: 28px;
    padding: 0px;
    margin: 0px;
    color: #2c3340;
    background-color: #ffffff;
}

QCalendarWidget QTableView::item:selected {
    background-color: #4a9ae8;
    color: #ffffff;
}

QCalendarWidget QToolButton {
    min-width: 28px;
    min-height: 28px;
    padding: 4px;
}

QCalendarWidget QSpinBox {
    min-width: 64px;
    min-height: 24px;
}

QTableWidget::item, QTableView::item {
    padding: 4px 6px;
    border: none;
    color: #2c3340;
}

QTableWidget::item:selected, QTableView::item:selected {
    background-color: #4a9ae8;
    color: #ffffff;
}

QHeaderView::section {
    background-color: #e8edf4;
    color: #3d4a5c;
    padding: 6px 8px;
    border: none;
    border-right: 1px solid #d0d7e2;
    border-bottom: 2px solid #4a9ae8;
    font-weight: 600;
}

/* 列表 */
QListWidget {
    background-color: #ffffff;
    border: 1px solid #c8d0dc;
    border-radius: 3px;
    outline: none;
    color: #2c3340;
}

QListWidget::item {
    padding: 5px 8px;
    border-bottom: 1px solid #e4e9f0;
}

QListWidget::item:selected {
    background-color: #4a9ae8;
    color: #ffffff;
}

QListWidget::item:hover:!selected {
    background-color: #eef3fa;
}

/* 文本框 / 日志 */
QPlainTextEdit#logView,
QPlainTextEdit#dataPreview {
    background-color: #f8f9fb;
    color: #2c3340;
    border: 1px solid #c8d0dc;
    border-radius: 3px;
    font-family: Consolas, "Cascadia Mono", monospace;
    font-size: 9pt;
    padding: 6px;
}

/* 下拉 */
QComboBox {
    background-color: #ffffff;
    color: #2c3340;
    border: 1px solid #b8c2d0;
    border-radius: 3px;
    padding: 4px 8px;
    min-height: 22px;
}

QComboBox::drop-down {
    border: none;
    width: 20px;
}

QComboBox QAbstractItemView {
    background-color: #ffffff;
    color: #2c3340;
    selection-background-color: #4a9ae8;
    selection-color: #ffffff;
    border: 1px solid #c8d0dc;
}

QCalendarWidget {
    background-color: #ffffff;
    min-width: 320px;
    min-height: 300px;
}

QDateEdit {
    background-color: #ffffff;
    color: #2c3340;
    border: 1px solid #b8c2d0;
    border-radius: 3px;
    padding: 4px 8px;
    min-height: 22px;
    min-width: 132px;
}

QDateEdit:focus {
    border-color: #4a9ae8;
}

/* 对话框 */
QDialog {
    background-color: #f5f7fa;
}

QDialog QLabel {
    color: #2c3340;
}

QDialog QLineEdit, QDialog QTextEdit, QDialog QComboBox, QDialog QDateEdit {
    background-color: #ffffff;
    color: #2c3340;
    border: 1px solid #b8c2d0;
    border-radius: 3px;
    padding: 4px 6px;
}

QDialogButtonBox QPushButton {
    min-width: 72px;
}

/* 滚动条 */
QScrollBar:vertical {
    background: #eef1f6;
    width: 10px;
    margin: 0;
}

QScrollBar::handle:vertical {
    background: #b8c2d0;
    border-radius: 4px;
    min-height: 24px;
}

QScrollBar::handle:vertical:hover {
    background: #9aa8bc;
}

QScrollBar:horizontal {
    background: #eef1f6;
    height: 10px;
}

QScrollBar::handle:horizontal {
    background: #b8c2d0;
    border-radius: 4px;
    min-width: 24px;
}

QScrollBar::add-line, QScrollBar::sub-line {
    width: 0;
    height: 0;
}

/* 分割条 */
QSplitter::handle {
    background-color: #c8d0dc;
}

QFrame#dashboardCard {
    background-color: #ffffff;
    border: 1px solid #d8dee8;
    border-radius: 8px;
}

QLabel#dashboardCardTitle {
    font-size: 11pt;
    font-weight: 600;
    color: #2c3340;
    padding-bottom: 4px;
}

QWidget#dashboardKpiContainer {
    background-color: transparent;
}

QWidget#dashboardKpiTile {
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
}

QLabel#dashboardKpiTitle {
    color: #5a6578;
    font-size: 9pt;
}

QLabel#dashboardKpiTotal {
    font-size: 24pt;
    font-weight: 700;
    color: #1976d2;
}

QLabel#dashboardKpiPending {
    font-size: 22pt;
    font-weight: 700;
    color: #90a4ae;
}

QLabel#dashboardKpiProgress {
    font-size: 22pt;
    font-weight: 700;
    color: #f9a825;
}

QLabel#dashboardKpiOverdue {
    font-size: 22pt;
    font-weight: 700;
    color: #e53935;
}

QLabel#dashboardKpiDone {
    font-size: 22pt;
    font-weight: 700;
    color: #43a047;
}

QLabel#dashboardLegendText {
    color: #2c3340;
}

QWidget#dashboardPanel,
QWidget#dashboardBody,
QScrollArea#dashboardScroll,
QScrollArea#dashboardScroll > QWidget > QWidget#dashboardBody {
    background-color: #ffffff;
    border: none;
}

QScrollArea#dashboardScroll QAbstractScrollArea::viewport {
    background-color: #ffffff;
}

QFrame#dashboardLegendSwatch {
    border: 1px solid #b8c2d0;
    border-radius: 2px;
}

QMessageBox {
    background-color: #f5f7fa;
}

QMessageBox QLabel {
    color: #2c3340;
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
