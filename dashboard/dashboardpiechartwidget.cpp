#include "dashboardpiechartwidget.h"

#include <QtMath>

#include <QFontMetrics>
#include <QPainter>
#include <QPaintEvent>

namespace {

QColor pieColorForStatus(const QString &status)
{
    if (status == QStringLiteral("待启动"))
        return QColor(QStringLiteral("#90a4ae"));
    if (status == QStringLiteral("进行中"))
        return QColor(QStringLiteral("#f9a825"));
    if (status == QStringLiteral("已完结"))
        return QColor(QStringLiteral("#43a047"));
    if (status == QStringLiteral("逾期"))
        return QColor(QStringLiteral("#e53935"));
    return QColor(QStringLiteral("#cfd8dc"));
}

} // namespace

DashboardPieChartWidget::DashboardPieChartWidget(QWidget *parent)
    : QWidget(parent)
{
    // 预留外侧标签空间（状态 + 数量 + 百分比）
    setFixedSize(280, 280);
}

QColor DashboardPieChartWidget::colorForStatus(const QString &status)
{
    return pieColorForStatus(status);
}

void DashboardPieChartWidget::setData(const QVector<DashboardStats::StatusCount> &rows)
{
    m_rows = rows;
    update();
}

void DashboardPieChartWidget::paintEvent(QPaintEvent *event)
{
    Q_UNUSED(event);
    QPainter painter(this);
    painter.setRenderHint(QPainter::Antialiasing, true);
    painter.setRenderHint(QPainter::TextAntialiasing, true);

    int total = 0;
    for (const DashboardStats::StatusCount &row : m_rows)
        total += row.count;

    const QPointF center(width() / 2.0, height() / 2.0);
    const qreal radius = 78.0;

    painter.setPen(Qt::NoPen);
    painter.setBrush(QColor(QStringLiteral("#eef1f6")));
    painter.drawEllipse(center, radius, radius);

    if (total <= 0) {
        painter.setPen(QColor(QStringLiteral("#78909c")));
        QFont emptyFont = painter.font();
        emptyFont.setPointSize(10);
        painter.setFont(emptyFont);
        painter.drawText(rect(), Qt::AlignCenter, QStringLiteral("暂无数据"));
        return;
    }

    // Qt drawPie：0° 在 3 点钟方向，逆时针为正；从 12 点钟起顺时针绘制
    qreal startAngle = 90.0 * 16.0;
    qreal angleCursorDeg = -90.0; // 数学角：0°=3点，-90°=12点

    for (const DashboardStats::StatusCount &row : m_rows) {
        if (row.count <= 0)
            continue;

        const qreal fraction = qreal(row.count) / qreal(total);
        const qreal span = -360.0 * 16.0 * fraction;
        const QColor color = pieColorForStatus(row.status);
        painter.setBrush(color);
        painter.drawPie(QRectF(center.x() - radius, center.y() - radius, radius * 2, radius * 2),
                        int(startAngle), int(span));

        const qreal sliceDeg = 360.0 * fraction;
        const qreal midDeg = angleCursorDeg + sliceDeg / 2.0;
        const qreal midRad = qDegreesToRadians(midDeg);
        const qreal labelR = radius + 36.0;
        const QPointF labelPos(center.x() + labelR * qCos(midRad),
                               center.y() + labelR * qSin(midRad));

        const qreal pct = fraction * 100.0;
        const QString line1 = row.status;
        const QString line2 = QStringLiteral("%1 (%2%)")
                                  .arg(row.count)
                                  .arg(QString::number(pct, 'f', 2));

        QFont titleFont = painter.font();
        titleFont.setPointSize(9);
        titleFont.setBold(true);
        QFont valueFont = painter.font();
        valueFont.setPointSize(9);
        valueFont.setBold(false);

        painter.setFont(titleFont);
        const QFontMetrics fmTitle(titleFont);
        const QFontMetrics fmValue(valueFont);
        const int w = qMax(fmTitle.horizontalAdvance(line1), fmValue.horizontalAdvance(line2));
        const int h = fmTitle.height() + fmValue.height() + 2;
        QRectF textRect(labelPos.x() - w / 2.0, labelPos.y() - h / 2.0, w, h);

        painter.setPen(color);
        painter.drawText(QRectF(textRect.left(), textRect.top(), textRect.width(), fmTitle.height()),
                         Qt::AlignHCenter | Qt::AlignVCenter, line1);
        painter.setFont(valueFont);
        painter.setPen(QColor(QStringLiteral("#546e7a")));
        painter.drawText(QRectF(textRect.left(), textRect.top() + fmTitle.height(),
                                textRect.width(), fmValue.height()),
                         Qt::AlignHCenter | Qt::AlignVCenter, line2);

        startAngle += span;
        angleCursorDeg += sliceDeg;
    }
}
