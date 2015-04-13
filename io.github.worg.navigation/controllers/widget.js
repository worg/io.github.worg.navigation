var duration = 400;
var oldView = null;

var init = function(opts) {
};


//
//  Set up the drawer
//
//  On iPhone the drawer has to be re-attached to windows with each navigation. 
//  On iPad the drawer is resident in the master view of the split window
//  On Android the drawer is resident in its own view
//

var drawer, drawerContent;
var detail = (OS_IOS && Alloy.isTablet) ? $.detailWindow : $.widget;

if(OS_IOS) {

    //
    //  WidgetViews are used to track the current position in navigation on iOS. They are not necessary in the Android
    //  implementation.
    //
    
    var widgetViews = [];
    
    /**
     * removes the widget of the view from the widgetViews list. This is fired onClose for iOS only, because we don't
     * trigger all window closures, sometimes the 
     */
    var removeWidgetView = function(e) {
        if(e.source.rightNavButton) {
            e.source.rightNavButton.removeEventListener('click', toggleDrawer);
            e.source.rightNavButton = null;
        }

        if (e.source.cleanup) {
            e.source.cleanup();
        };

        for(var i = widgetViews.length-1; i >= 0; i--) {
            if(widgetViews[i].window === e.source) {
                widgetViews.splice(i, 1);
                break;
            }
        }
    };  

} else {
    
    /**
     * Only used on android. Updates the action bar so the title matches the window and the top-left icon is sensitive
     * to the scroll position -- opens the drawer if on the first page, goes back if not.
     */
    var updateActionBar = function() {
        
        setTimeout(function() {
            var actionBar = detail.activity.actionBar;
            if(actionBar && $.navigation.views && $.navigation.views.length > 0) {
                var lastView = _.last($.navigation.views);
                actionBar.title = _.last($.navigation.views).title;
                    
                actionBar.icon = "/drawable-xxhdpi/io.github.worg.navigation/ic_action_back.png";
                actionBar.onHomeIconItemSelected = function() {setTimeout(retreat, 0);};
            }
        }, 10);
        
    };
    
}


/**
 *  The "drill-down" feature. This is how you navigate to the right, or deeper into the navigation tree.
 *  view {Ti.UI.View} The view for the screen we are navigating into
 */
var advance = function(view) {

    if (oldView && view.id == oldView.id) {
     retreat();
     return;
    }

    oldView = OS_IOS ? (widgetViews.length > 0 ? _.last(widgetViews).content : null) :
              ($.navigation.views.length > 0 ? _.last(navigation.views).content : null);
    
    $.trigger('nav:advance', {id: view.id});
    advanceImpl(view, false);
    Alloy.Globals.currentView = view;
};


if(OS_IOS) {
    
    var advanceImpl = function(view) {

        setTimeout(function() {

            var pageWidget, win;
    
            if(widgetViews.length === 0) {
                // adding the root to the widgets. Because Alloy requires NavigationWindow to have at least one child,
                // the widget already exists, we just add our stuff to it
                pageWidget = $.first;
                win = $.first.getView();
    
            } else {
                pageWidget = Widget.createWidget('io.github.worg.navigation', 'page');
                win = pageWidget.getView();
            }

            Ti.API.warn('WIN:', win)
    
            widgetViews.push({window: win, widget: pageWidget, content:view});
            win.addEventListener("close", removeWidgetView);
    
            // create window using the page widget
            pageWidget.content.add(view);
    
            win.title = view.title;

            // advance animation
            if(widgetViews.length > 1) {
                detail.openWindow(win, {animated:true});
            }
            
        }, 0);

    };

} else {

    var advanceImpl = function(view, first) {
        if(first) {
            // place the view at the beginning of the list then immediately change to it
            $.navigation.views = [view].concat($.navigation.views);
            $.navigation.currentPage = 0;
        } else {
            // place it to the right of the screen then slide it in over top of the existing content
            $.navigation.addView(view);
            $.navigation.scrollToView(view);        
        }
        
        
        detail.title = _.last(detail.children).title;
        
        if($.navigation.views.length == 1) {
            $.widget.addEventListener('open', updateActionBar);
        } else {
            updateActionBar();
        }
    };
    
}

/**
 * Goes back in the progression of screens.
 * @param {number|Ti.UI.View} how far back to go. If omitted, this will go back one screen. If negative, it'll go
 *  back n screens. If positive, it'll go back to the nth screen. If the index is actually a view, it'l go back to
 *  that view.
 */
var retreat = function(index) {
    
    var viewsArray = OS_IOS ? widgetViews : $.navigation.views;

    // determine how many screens I need to retreat
    var steps = 0;
    if(undefined === index) {
        steps = 1;
        
    } else if(typeof index === 'object') {
        
        for(i = viewsArray.length-1; i >= 0; i--) {
            if(index === (OS_IOS ? viewsArray[i].content : viewsArray[i])) {
                steps = viewsArray.length - i - 1;
                break;
            }
        }
        
    } else if(index < 0) {
        steps = -index;
        
    } else if(index > 0) {
        steps = viewsArray.length - index;
        
    }
    
    if(steps <= 0) {
        // zero or invalid input
        // do nothing;
        return;
    }
    
    if(steps >= viewsArray.length) {
        // ensure I am not going back beyond the beginning
        steps = viewsArray.length - 1;
    }

    if(OS_IOS) {
        // close all the windows that are no longer needed, the current window must be closed last.
        windowsToClose = _.last(widgetViews, steps);
        _.each(windowsToClose, function(element) {
            // the setTimeout is to ensure that the operation doesn't occur before the closeDrawer has is complete.
            setTimeout(function() {
                detail.closeWindow(element.window);
            }, 0);
        });

    } else {

        $.navigation.scrollToView(_.first(_.last($.navigation.views, steps+1)));
        setTimeout(function() {
            for(var i = 0; i < steps; i++) {
                $.navigation.removeView(_.last($.navigation.views));
            }
        }, 0);

        updateActionBar();

    }
};

/**
 *  Returns to the root of the navigation tree, or moves to a new root navigation.
 *  @param newHome {Ti.UI.View} if starting a new navigation tree, this is the root screen.
 */
var home = function(newHome) {

    if(newHome) {
        
        if(OS_IOS) {
            
            for(var i = 1; i < widgetViews.length; i++) {
                detail.closeWindow(widgetViews[i].window);
            }

            var oldContent = widgetViews[0].content;

            widgetViews = [];

            advance(newHome);
            
            $.first.content.remove(oldContent);
                        
    
        } else {

            advanceImpl(newHome, true);
            $.navigation.views = [newHome];

        }

    } else {

        if(OS_IOS) {
            
            retreat(1);
            
        } else {

            home($.navigation.views[0]);
            
        }

    }
    
};

if(OS_IOS && Alloy.isTablet) {
}

if(OS_ANDROID) {

    var back = function(e) {
        if($.navigation.views.length > 1) {
            retreat();
            e.cancelBubble = true;
        } else {
            delete Alloy.Globals.navigation;
            $.widget.close();
            Ti.Android.currentActivity.finish();
        }
    };

    detail.addEventListener('androidback', back);
    
}

_.extend($, {
    init: init,
    advance: advance,
    retreat: retreat,
    home: home,
});