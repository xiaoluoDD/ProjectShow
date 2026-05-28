QT       += core gui widgets network

CONFIG   += c++17 warn_on depend_includepath
TEMPLATE = app
TARGET   = ProjectKanban

SOURCES += \
    main.cpp \
    mainwindow.cpp \
    projectpanelwidget.cpp \
    debugpanelwidget.cpp \
    logpanelwidget.cpp \
    applogger.cpp

HEADERS += \
    mainwindow.h \
    projectpanelwidget.h \
    debugpanelwidget.h \
    logpanelwidget.h \
    applogger.h

# Qt 6.7.3，MSVC / MinGW 下保证源文件 UTF-8
msvc: QMAKE_CXXFLAGS += /utf-8

DEFINES += QT_DEPRECATED_WARNINGS
