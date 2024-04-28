let app = angular
  .module('catalogue', [
    'ngAnimate',
    'ngAria',
    'ngMessages',
    'ngRoute',
    'ngSanitize',
    'ngMaterial',
    'ngStorage',
    'angularMoment',
    'ngWebSocket',
    'ngFitText',
    'ng-echarts',
    'list',
    'nodegraph'
  ]).config(function ($routeProvider, $mdThemingProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'list/list.template.html',
        controller: 'listController'
      })
      .when('/nodegraph', {
        templateUrl: 'nodegraph/nodegraph.template.html',
        controller: 'nodegraphController'
      })
      .otherwise({
        redirectTo: '/'
      });

    $mdThemingProvider.definePalette('lightPalette', {
      '50': '#f1f8e9',
      '100': '#dcedc8',
      '200': '#c5e1a5',
      '300': '#aed581',
      '400': '#9ccc65',
      '500': '#ed79b6',
      '600': '#7cb342',
      '700': '#689f38',
      '800': '#707070',
      '900': '#33691e',
      'A100': '#ccff90',
      'A200': '#b2ff59',
      'A400': '#76ff03',
      'A700': '#64dd17',
      // By default, text (contrast) on this palette should be dark with 87% opacity.
      'contrastDefaultColor': 'dark',
      // By default, for these darker hues, text (contrast) should be white with 100% opacity.
      'contrastStrongLightColors': '800 900'
    });
    $mdThemingProvider.definePalette('darkPalette', {
      '50': 'ffebee',
      '100': 'ffcdd2',
      '200': 'ef9a9a',
      '300': 'e57373',
      '400': 'ef5350',
      '500': 'd5d5d5',
      '600': 'e53935',
      '700': 'd32f2f',
      '800': '4a4a4a',
      '900': 'b71c1c',
      'A100': 'ff8a80',
      'A200': 'ff5252',
      'A400': 'ff1744',
      'A700': 'd50000',
      // By default, text (contrast) on this palette should be white with 87% opacity.
      'contrastDefaultColor': '#717171',
      // By default, for these lighter hues, text (contrast) should be 'dark'.
      'contrastDarkColors': '50 100 200 300 400 500 600 A100 A200 A400',
      // By default, for these darker hues, text (contrast) should be white with 100% opacity.
      'contrastStrongLightColors': '700 800 900 A700'
    });
    $mdThemingProvider.theme('default').primaryPalette('darkPalette');
    $mdThemingProvider.theme('dark').primaryPalette('darkPalette').dark();
    $mdThemingProvider.theme('light').primaryPalette('lightPalette');


  });

app.run(function ($rootScope, $window, $timeout, $animate) {
  $rootScope.loading = {
    isLoading: true,
    loadingBg: true,
    statusText: "Loading Catalogue..."
  };

  $rootScope.$on("initialLoading", function (event, data) {
    if (data.progress_percent) {

      $timeout(function () {
        $rootScope.loading.progress = data;

        if (data.progress_percent === 100) {
          $timeout(function () {
            $rootScope.loading.loadingBg = false;
          })
          $timeout(function () {
            $rootScope.loading.isLoading = false;
            console.log("finished loading catalogue")
          }, 500)

        }
      })

    }
    if (data.statusText) {
      $rootScope.loading.statusText = data.statusText;
    }
  });

  let hour = new Date().getHours();
  if ((hour > 6) && (hour < 17)) {
    $rootScope.darkMode = false;
  } else {
    $rootScope.darkMode = true;
  };
  $rootScope.getTheme = function () {
    if ($rootScope.darkMode === true) {
      return 'dark';
    } else {
      return 'light';
    }
  };
  $rootScope.toggleTheme = function () {
    $rootScope.darkMode = !$rootScope.darkMode;
    console.log("dark mode: " + $rootScope.darkMode);
  };
});

function EditEntryController($scope, $mdDialog) {
  $scope.hide = function () {
    $mdDialog.hide();
  };

  $scope.cancel = function () {
    $mdDialog.cancel();
  };

  $scope.answer = function (answer) {
    $mdDialog.hide(answer);
  };

  $scope.keyPress = function (event) {
    if (event.keyCode === 13) {
      $mdDialog.hide('update');
    };
    if (event.keyCode === 27) {
      $mdDialog.cancel();
    };
  }
};

app.directive('classification', function ($http) {
  return {
    restrict: 'E',
    templateUrl: 'partials/classification.html',
    scope: {
      classification: '='
    },
    link: function (scope, element) {

    }
  }
});

let lineStyles = [
  { line: 'rgb(237,121,182)', transparent: 'rgba(237,121,182,0.02)', fill: 'rgba(237, 121, 182, 0.11)' }, // pink
  { line: 'rgb(120,255,35)', transparent: 'rgba(120,255,35,0.02)', fill: 'rgba(120,255,35, 0.1)' }, // green
  { line: 'rgb(255,218,35)', transparent: 'rgba(255,218,35,0.02)', fill: 'rgba(255,218,35, 0.1)' }, // yellow
  { line: 'rgb(144,45,253)', transparent: 'rgba(144,45,253,0.02)', fill: 'rgba(144,45,253, 0.1)' }, // purple
  { line: 'rgb(253,45,141)', transparent: 'rgba(253,45,141,0.02)', fill: 'rgba(253,45,141, 0.1)' }, // red
  { line: 'rgb(45,253,176)', transparent: 'rgba(45,253,176,0.02)', fill: 'rgba(45,253,176, 0.1)' }, // teal
]

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomLineStyle(type) {
  let random = getRandomInt(0, (lineStyles.length - 1));
  if (type === "fill") {
    return lineStyles[random].fill
  } else if (type === "transparent") {
    return lineStyles[random].transparent
  } else {
    return lineStyles[random].line
  }
};

app.directive('resizableColumns', function ($compile, $window, $document, $timeout) {
  return function (scope, el, attrs) {

    let tableHeader = document.querySelectorAll('*[resizable-header]')[0];
    let windowWidth = $window.innerWidth;

    //console.log(tableHeader);

    let tableHeaderEl = angular.element(tableHeader);
    let tableHeaderChildren = Array.from(tableHeaderEl.children());
    let draggedElement;
    let dragOffset;
    let widthAndNextWidth;
    let offset;

    function mouseMove(event) {
      scope.$apply(function () {
        console.log(event.clientX - offset);
        dragOffset = event.clientX - offset;
        let targetClass = Array.from(draggedElement[0].classList)[1];
        let columnIndex = columns.findIndex(x => (x.class === targetClass));
        if ((columns[columnIndex].width + dragOffset >= 10) && ((columns[columnIndex + 1].width - dragOffset) >= 10)) {
          $('.' + targetClass).width(columns[columnIndex].width + dragOffset);
          $('.' + columns[columnIndex + 1].class).width(columns[columnIndex + 1].width - dragOffset);
        };
      });
    };

    function mouseUp(event) {
      let targetClass = Array.from(draggedElement[0].classList)[1];
      let columnIndex = columns.findIndex(x => (x.class === targetClass));

      scope.$apply(function () {
        console.log(columns[columnIndex], draggedElement, dragOffset);
        console.log(columns[columnIndex + 1]);
        //$('.'+targetClass).width(columns[columnIndex].width+dragOffset);

        columns[columnIndex].width = columns[columnIndex].width + dragOffset;
        columns[columnIndex + 1].width = columns[columnIndex + 1].width - dragOffset;
        columns[columnIndex].width_percent = (columns[columnIndex].width / windowWidth) * 100;
        columns[columnIndex + 1].width_percent = (columns[columnIndex + 1].width / windowWidth) * 100;
        //$('.'+columns[columnIndex+1].class).width(columns[columnIndex+1].width-dragOffset);

        $('.' + targetClass + ">.resizer-horizontal").css("border-color", "rgba(124, 124, 124, 0.22)");
        console.log(columns);
        let styleContent = "";
        columns.forEach(function (column) {
          let style = "." + column.class + "{width:" + column.width + "px !important;}";
          styleContent += style;
        });

        $('<style id="resizable-column-style">').text(styleContent).appendTo(document.head);

      });

      $document.unbind('mousemove', mouseMove);
      $document.unbind('mouseup', mouseUp);
      console.log(columns);
    }

    let columns = [];

    tableHeaderChildren.forEach(function (child, index) {

      let resizerParent = angular.element(child);
      let targetClass = Array.from(resizerParent[0].classList)[1];

      let initialWidth;

      if (index !== (tableHeaderChildren.length - 1)) {
        let resizerElement = $('<div class="resizer-horizontal"></div>');
        resizerParent.append($compile(resizerElement)(scope));



        $timeout(function () {
          initialWidth = resizerParent[0].clientWidth;

          if ((index !== (tableHeaderChildren.length - 1)) && resizerElement) {

            resizerElement.on('mousedown', function (evt) {
              evt.preventDefault();
              offset = event.clientX;
              let columnIndex = columns.findIndex(x => (x.class === targetClass));
              columns[columnIndex].width = resizerParent[0].clientWidth;
              draggedElement = resizerParent;
              console.log("mouse DOWN", event.clientX, event.clientY);
              columns.forEach(function (column) {
                $('.' + column.class).width(columns.width);
              });
              $('#resizable-column-style').remove();
              $('.' + targetClass + ">.resizer-horizontal").css("border-color", "rgb(237,121,182)");

              $document.on('mousemove', mouseMove);
              $document.on('mouseup', mouseUp);
            });
          };

          columns.push({ class: targetClass, width: initialWidth, width_percent: Math.round((initialWidth / windowWidth) * 100) });
          //console.log({class:targetClass,width:initialWidth,width_percent:Math.round((initialWidth/windowWidth)*100)+'%'});

        }, 250);
      };


    });

    angular.element($window).on('resize', function () {
      windowWidth = $window.innerWidth;
      console.log(windowWidth);
      columns.forEach(function (column) {
        column.width = Math.round(((windowWidth * 0.1) * column.width_percent)) / 10;
        $('.' + column.class).width(column.width);
        //console.log(column);

      });
      let styleContent = "";
      columns.forEach(function (column) {
        let style = "." + column.class + "{width:" + column.width + "px !important;}";
        styleContent += style;
      });
      $('#resizable-column-style').remove();
      $('<style id="resizable-column-style">').text(styleContent).appendTo(document.head);
      scope.$digest();
    });

  }
});

app.directive('forceGraph', function ($http, detailsFactory, sizeWatcher, $timeout, $window) {
  return {
    restrict: 'E',
    scope: {
      data: '=',
      activenode: '=',
      typefilter: '=',
      darkmode: '=',
    },
    link: function (scope, element) {

      let Graph;

      let container = element[0];
      let watcher = new sizeWatcher(container, 100);

      scope.$watchGroup(watcher.group, function (values) {
        if ((typeof Graph !== 'undefined') && (values[0] !== 0) && (values[1] !== 0)) {
          Graph.width(values[0]);
          Graph.height(values[1]);
        };
      });

      const highlightNodes = new Set();
      const highlightLinks = new Set();

      let distance = 500;
      let chargeStrength = -2500;
      let linkDistance = 100;
      let coolDownTime = 1700;
      let movieFontSize = 17;
      let expansion = 0;
      let justAddedNodes = false;
      let forceDecay = 0.33;


      let spriteBackgroundColor = 'rgba(25, 25, 25, 0.92)';
      let spriteTextColor = 'rgba(198, 198, 198, 1)';


      let linkColor
      let linkColorTransparent
      let linkColorFiltered

      if (scope.darkmode === true) {
        // darkMode is on
        linkColor = 'rgba(220, 220, 220, 0.82)';
        linkColorTransparent = 'rgba(152, 152, 152, 0.2)';
        linkColorFiltered = 'rgba(220, 220, 220, 1)';
      } else {
        linkColor = 'rgba(25, 25, 25, 0.92)';
        linkColorTransparent = 'rgba(112, 112, 112, 0.2)';
        linkColorFiltered = 'rgba(25, 25, 25, 1)';
      }

      let tmdbBorderColor = 'rgba(45,224,253,1)';
      let borderColor = 'rgba(237,121,182,1)';

      function flyToNodeId(nodeid, timeout) {
        if ((scope.data) && (Graph)) {
          let nodeIndex = scope.data.nodes.findIndex(x => (x.id === nodeid));
          let node = scope.data.nodes[nodeIndex];

          if (nodeIndex !== -1) {
            // make the node opaque
            //console.log("Fyling to X="+node.y+" Y="+node.y+" timeout:"+timeout);
            if (!timeout) {
              flyToNode(node);

            } else {
              setTimeout(flyToNode(node), timeout)
            }
          }
        }
      };

      function flyToNode(node) {

        let distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        Graph.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
          node, // lookAt ({ x, y, z })
          1000  // ms transition duration
        )

      }

      function getNodeVisibility(node) {
        if ((scope.typefilter === null) || (typeof scope.typefilter == "undefined")) {
          return true
        } else {

          let filteredIndexInLinks = scope.data.links.findIndex(x => ((((x.target.group === scope.typefilter) || (x.source.group === scope.typefilter)) && ((x.target.id === node.id) || (x.source.id === node.id)))))

          if ((node.filtered === true) || (node.group === 'DVD') || (node.group === 'BD') || (filteredIndexInLinks > -1)) {
            return true
          } else {
            return false
          }

        }
      }

      function redrawGraph(timeout) {

        if (timeout) {
          $timeout(function () {
            Graph.refresh().linkColor(getLinkColor).nodeVisibility(getNodeVisibility).linkVisibility(getLinkVisibility)
          }, timeout)
        } else {
          Graph.refresh().nodeVisibility(getNodeVisibility).linkVisibility(getLinkVisibility)
        }
        // trigger update of highlighted objects in scene
        //Graph.nodeThreeObject(Graph.nodeThreeObject());
        //Graph.nodeVisibility(getNodeVisibility);
        // .linkWidth(Graph.linkWidth())
        // .linkDirectionalParticles(Graph.linkDirectionalParticles());
      }

      const getLinkColor = function (link) {
        /* 
                if ((scope.typefilter !== null) && (typeof scope.typefilter !== "undefined") && (link.source.group !== scope.typefilter) && (link.target.group !== scope.typefilter)) {
                  return linkColorTransparent
                } else if (((scope.typefilter !== null) && (typeof scope.typefilter !== "undefined") && ((link.source.group === scope.typefilter) || (link.target.group === scope.typefilter)))||( (link.target.id === scope.activenode)||(link.source.id === scope.activenode) )) {
                  return linkColorFiltered
                } else {
                  return linkColor
                }
         */
        return linkColor

      }

      const getLinkVisibility = function (link) {

        if ((scope.typefilter !== null) && (typeof scope.typefilter !== "undefined")) {

          let sourceNodeIndex = scope.data.nodes.findIndex(x => x.id === link.source)
          let targetNodeIndex = scope.data.nodes.findIndex(x => x.id === link.target)
          let sourceNode = scope.data.nodes[sourceNodeIndex]
          let targetNode = scope.data.nodes[targetNodeIndex]

          if ((link.source === scope.activenode) || (link.target === scope.activenode) || (link.source.group === scope.typefilter) || (link.target.group === scope.typefilter) || (sourceNode?.filtered === true) || (targetNode?.filtered === true)) {
            return true
          } else {
            return false
          }
        } else {
          return true
        }

      }


      function updateGraph() {
        if (!Graph) {
          Graph = ForceGraph3D()(element[0])
            .backgroundColor('rgba(0,0,0,0.00000001)')
            .showNavInfo(false)
            .forceEngine('d3')
            .height(element[0].clientHeight)
            .width(element[0].clientWidth)
            .d3AlphaDecay(forceDecay)
            .enableNodeDrag(false)
            .linkWidth(1)
            .linkColor(getLinkColor)
            .nodeVisibility(getNodeVisibility)
            .linkVisibility(getLinkVisibility)
            .onNodeHover(node => element[0].style.cursor = node ? 'pointer' : null)
            .onNodeClick(node => {
              console.log(node);
              if (scope.activenode) {
                if ((scope.activenode === node.id) && (node.expanded !== true) && (node.type !== 'movie')) {
                  console.log("This is the second click on " + node.id);
                  node.backgroundColor = 'rgb(237,121,182)';
                  highlightNodes.add(node);
                  expansion += 1;
                  $http.get('/api/nodegraph/person/' + node.id + '/' + expansion).then(function (response) {
                    if ((response.data.nodes) || (response.data.links)) {
                      node.expanded = true;
                      let newNodes = [];
                      let newLinks = [];
                      response.data.nodes.forEach(function (node) {
                        let existingIndex = scope.data.nodes.findIndex(x => (x.id === node.id));
                        if (existingIndex === -1) {

                          newNodes.push(node);
                        }
                      });
                      response.data.links.forEach(function (link) {
                        let existingIndex = scope.data.links.findIndex(x => ((x.target === link.target) && (x.source === link.source)) || ((x.source === link.target) && (x.target === link.source)));
                        if (existingIndex === -1) {
                          newLinks.push(link);
                        }
                      });
                      scope.data = {
                        nodes: scope.data.nodes.concat(newNodes),
                        links: scope.data.links.concat(newLinks)
                      };
                      highlightNodes.add(newNodes);
                      justAddedNodes = true;
                      Graph.graphData(scope.data)

                      redrawGraph(1000)

                      scope.activenode = node.id;
                      flyToNode(node);


                    }
                  });

                } else {
                  scope.activenode = node.id;
                  justAddedNodes = false;
                  if ((node.group === 'DVD') || (node.group === 'BD')) {
                    detailsFactory.setItemByName(node.id);
                  } else if (node.group === 'TMDB') {
                    let url = "https://www.youtube.com/results?search_query=" + node.id;
                    if (node.year) {
                      url += ("%20" + node.year)
                    };
                    url += ("%20trailer")
                    $window.open(url, '_blank');
                  }
                  flyToNode(node);
                }
              } else if ((node.group === 'DVD') || (node.group === 'BD')) {
                scope.activenode = node.id;


                detailsFactory.setItemByName(node.id);

                flyToNode(node);
              } else {
                scope.activenode = node.id;

                flyToNode(node);

              }

            })
            .nodeThreeObject(node => {
              let randomColor = getRandomLineStyle();
              const sprite = new SpriteText();

              sprite.borderRadius = 3;

              let bgColor = spriteBackgroundColor
              let textColor = spriteTextColor

              let tmdbBorder = tmdbBorderColor
              let border = borderColor
              /* 
                            if ((scope.typefilter !== null) && (typeof scope.typefilter !== "undefined") && (node.filtered !== true) && (node.group !== 'DVD') && (node.group !== 'BD')) {
                              // type-filtering is on
              
                              randomColor = getRandomLineStyle('transparent');
              
                              bgColor = 'rgba(35, 35, 35, 0.2)';
                              textColor = 'rgba(198, 198, 198, 0.2)';
                              tmdbBorder = 'rgba(45,224,253,0.02)';
                              border = 'rgba(237,121,182,0.02)';
              
                            } */

              if (highlightNodes.has(node)) {
                sprite.backgroundColor = 'rgb(237,121,182)';
              }

              if (node.type === 'movie') {
                if (node.year) {
                  sprite.text = node.id + ' (' + node.year + ')';
                } else {
                  sprite.text = node.id;
                }
                sprite.color = textColor;
                sprite.backgroundColor = bgColor;
                sprite.fontWeight = '200';
                sprite.textHeight = movieFontSize;
                sprite.padding = [10, 20];
                sprite.borderWidth = 1;
                if (node.group === 'TMDB') {
                  sprite.borderColor = tmdbBorder;
                } else {
                  sprite.borderColor = border;
                }

                if (node.expansion > 0) {
                  sprite.borderColor = node.borderColor || randomColor;
                  node.borderColor = sprite.borderColor;
                }
                return sprite;
              } else {
                sprite.text = node.id + '\n(' + node.group + ')';
                sprite.color = textColor;
                sprite.backgroundColor = bgColor;
                sprite.fontWeight = '100';
                sprite.textHeight = 8;
                sprite.padding = 3;

                /* 
                                if (node.group === 'Directing') {
                                  sprite.borderColor = 'rgba(237, 121, 182, 0.22)';
                                  sprite.borderWidth = 1;
                                } */

                if (node.expansion > 0) {
                  sprite.borderColor = node.borderColor || randomColor;
                  node.borderColor = sprite.borderColor;
                }
                return sprite;
              }

            });
        }
        Graph.d3Force('charge').strength(chargeStrength);
        Graph.d3Force('link').distance(linkDistance);
        Graph.onEngineStop(function () {
          if ((justAddedNodes === true) && (scope.activenode)) {
            flyToNodeId(scope.activenode);
          };
        }).cooldownTime(coolDownTime);
        Graph.graphData(scope.data);
      }
      scope.$on("$destroy", function () {
        Graph.pauseAnimation()
        console.log('destroy forceGraph directive')
      });
      scope.$watch('data', function (newVal, oldVal) {
        if (oldVal !== newVal) {
          updateGraph();
        }
      })
      scope.$watch('activenode', function (newVal, oldVal) {

        if (newVal) {
          if (oldVal !== newVal) {


            if ((scope.typefilter !== null) && (typeof scope.typefilter !== "undefined")) {
              let nodeIndex = scope.data.nodes.findIndex(x => (x.id === newVal));
              scope.data.nodes[nodeIndex].filtered = true
              redrawGraph();
            }

            flyToNodeId(newVal);
          }
        }

      })
      scope.$watch('typefilter', function (newVal, oldVal) {
        if ((oldVal !== newVal) && (typeof newVal !== 'undefined')) {
          console.log("filter nodes for type " + newVal)
          if (newVal !== null) {

            let activeNodes = 0;
            scope.data.nodes = scope.data.nodes.map(function (node) {
              if (node.group === newVal) {
                activeNodes += 1
                node.filtered = true;
              } else {
                node.filtered = false;
              }
              return node
            })

            console.log("active nodes " + activeNodes, scope.data)
            redrawGraph();

          } else {

            scope.data.nodes.forEach(function (node) {
              node.filtered = false;
            })
            console.log("active nodes " + scope.data.nodes.length, scope.data)
            redrawGraph();

          }
        }
      })
      scope.$watch('darkmode', function (newVal, oldVal) {
        if (newVal) {
          if (oldVal !== newVal) {
            console.log("dark mode is: " + newVal);
            if (newVal === true) {
              // darkMode is on
              linkColor = 'rgba(220, 220, 220, 0.82)';
              linkColorTransparent = 'rgba(152, 152, 152, 0.2)';
              linkColorFiltered = 'rgba(220, 220, 220, 1)';
            } else {
              linkColor = 'rgba(25, 25, 25, 0.92)';
              linkColorTransparent = 'rgba(112, 112, 112, 0.2)';
              linkColorFiltered = 'rgba(25, 25, 25, 1)';
            };
            redrawGraph();
          }
        }
      })
    }
  }
})

app.directive('rating', function ($http) {
  return {
    restrict: 'E',
    templateUrl: 'partials/star-rating.html',
    scope: {
      rating: '=',
      id: '='
    },
    link: function (scope, element) {
      let rating = scope.rating;
      if (!scope.rating) {
        scope.rating = 0;
      }
      scope.setRating = function (star) {
        if (scope.rating === star) {
          scope.rating = 0;
        } else {
          scope.rating = star;
        }
        $http.post('/api/rate', { id: scope.id, rating: scope.rating }).then(function (response) {
          console.log(response.data.result + " rating " + scope.rating)
        });
      }
    }
  }
})

app.directive('bbfc', function ($compile, $rootScope, detailsFactory, $http) {
  return {
    restrict: 'E',
    scope: {
      //rating: '=',
      panelstate: "&?",
      visible: "="
    },
    link: function (scope, elem, attrs) {
      let config =
      {
        id: 'bbfc',
        headerTitle: "BBFC",
        position: attrs.position,
        theme: '#717171',
        panelSize: attrs.size,
        setpanelstate: 'minimized',
        onwindowresize: true,
        headerControls: {
          close: 'remove',
          maximize: 'remove',
          smallify: 'remove',
          size: 'xs'
        },
        onnormalized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: true });
          scope.$apply();
        },
        onminimized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: false });
        },
        resizeit: {
          stop: (panel, paneldata, event) => {
            console.log("resize panel " + panel.id);
            compileTemplate();
          }
        }
      };


      let templateHtml;
      let panel;

      if (scope.visible === false) {
        panel = jsPanel.create(config).minimize();
      } else {
        panel = jsPanel.create(config);
      }


      function compileTemplate() {
        if (!panel) {
          panel = jsPanel.create(config);
          if (scope.visible === false) {
            panel.minimize();
          }
        };
        if (!templateHtml) {
          $http.get('partials/bbfc.html').then(function (response) {
            templateHtml = response.data;
            let html = $compile(templateHtml)(scope);
            panel.contentRemove();
            panel.content.append(html[0]);
          });
        } else {
          let html = $compile(templateHtml)(scope);
          panel.contentRemove();
          panel.content.append(html[0]);
        }

      };

      scope.$watch('rating', function () {
        compileTemplate();
      });

      $rootScope.$on('select-item', function () {
        detailsFactory.getBbfc().then(function (rating) {
          scope.rating = rating;
        }).catch(function () {
          console.log("BBFC Rating Unavailable");
          delete scope.rating;
        })
      });
    }
  }
})

app.directive('dvdctrl', function ($compile, $rootScope, $http, machineFactory) {
  return {
    restrict: 'E',
    scope: {
      //rating: '=',
      panelstate: "&?",
      visible: "="
    },
    link: function (scope, elem, attrs) {

      let panel;
      function compileTemplate() {
        $http.get('partials/dvdctrl.html').then(function (response) {
          if (!panel) {
            panel = jsPanel.create(config);
            if (scope.visible === false) {
              panel.minimize();
            }
          }
          let html = $compile(response.data)(scope);
          panel.contentRemove();
          panel.content.append(html[0]);
        });
      }

      let config =
      {
        id: 'dvdctrl',
        headerTitle: "DVD Controls",
        position: attrs.position,
        theme: '#717171',
        panelSize: attrs.size,
        setpanelstate: 'minimized',
        onwindowresize: true,
        headerControls: {
          close: 'remove',
          maximize: 'remove',
          smallify: 'remove',
          size: 'xs'
        },
        resizeit: {
          minWidth: 150,
          minHeight: 150,
          maxWidth: 450,
          maxHeight: 450,
          aspectRatio: 'panel'
        },
        onnormalized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: true });
          scope.$apply();

        },
        onminimized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: false });
        }
      };
      compileTemplate();



      scope.dvdCommand = function (dvdcmd) {
        machineFactory.getSelectedMachine().then(function (machine) {
          $http.get('/api/dvd/' + machine.name + '/' + dvdcmd).then(function (response) {
            console.log(machine.name + ": " + dvdcmd, response.data);
          });
        }).catch(function () {
          console.log("no machine selected in remote");
        })
      };
    }
  }
});

app.directive('mpaa', function ($compile, $rootScope, $http, detailsFactory) {
  return {
    restrict: 'E',
    scope: {
      //rating: '=',
      panelstate: "&?",
      visible: "="
    },
    link: function (scope, elem, attrs) {
      let config =
      {
        id: 'mpaa',
        headerTitle: "MPAA",
        position: attrs.position,
        theme: '#717171',
        panelSize: attrs.size,
        setpanelstate: 'minimized',
        onwindowresize: true,
        headerControls: {
          close: 'remove',
          maximize: 'remove',
          smallify: 'remove',
          size: 'xs'
        },
        onnormalized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: true });
          scope.$apply();
        },
        onminimized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: false });
        },
        resizeit: {
          stop: (panel, paneldata, event) => {
            if (scope.tabIndex === 1) {
              compileTemplate();
            }
          }
        }
      };

      let panel;
      let templateHtml;


      if (scope.visible === false) {
        panel = jsPanel.create(config).minimize();
      } else {
        panel = jsPanel.create(config);
      };


      function compileTemplate() {
        if (!panel) {
          panel = jsPanel.create(config);
          if (scope.visible === false) {
            panel.minimize();
          }
        };
        if (!templateHtml) {
          $http.get('partials/mpaa.html').then(function (response) {
            templateHtml = response.data;
            let html = $compile(templateHtml)(scope);
            panel.contentRemove();
            panel.content.append(html[0]);
          });
        } else {
          let html = $compile(templateHtml)(scope);
          panel.contentRemove();
          panel.content.append(html[0]);
        }

      };

      scope.$watch('rating', function () {
        compileTemplate();
      });

      $rootScope.$on('select-item', function () {
        detailsFactory.getMpaa().then(function (rating) {
          scope.rating = rating;
          console.log(scope.rating);
        }).catch(function () {
          console.log("MPAA Rating Unavailable");
          delete scope.rating;
        })
      });

    }
  }
})

app.directive('framegrabs', function ($compile, $http, $rootScope, detailsFactory) {
  return {
    restrict: 'E',
    scope: {
      //framegrabs: '=',
      panelstate: "&?",
      visible: "="
    },
    link: function (scope, elem, attrs) {

      let templateHtml;
      let panel;

      $http.get('partials/framegrabs.html').then(function (response) {
        templateHtml = response.data;
      });

      function compileTemplate() {
        if (!panel) {
          panel = jsPanel.create(config);
          if (scope.visible === false) {
            panel.minimize();
          }
        }
        let html = $compile(templateHtml)(scope);
        panel.contentRemove();
        panel.content.append(html[0]);
      }

      function initPanel(visibility) {
        if (!panel) {
          panel = jsPanel.create(config);
          if (scope.visible === false) {
            panel.minimize();
          }
        }
        let scope = $rootScope.$new();
        let html = $compile('<div flex class="framegrabs-content" layout="column" layout-align="start stretch">\
            <div flex="100" class="framegrabs-missing-container" layout="column" layout-align="center center">\
              <div class="framegrabs-missing-container">\
                <span class="material-icons panel-element framegrabs-missing">no_photography</span>\
              </div>\
              <div class="panel-element rating-title"><span id="missing-framegrabs-title" class="missing-data">No stills for this title</span></div>\
            </div>')(scope);
        panel.content.append(html[0]);
      }

      scope.framegrabNav = function (direction) {
        if (scope.framegrabs.urls.length) {
          if (direction === 'next') {
            if (scope.framegrabs.tabIndex !== (scope.framegrabs.urls.length - 1)) {
              scope.framegrabs.tabIndex += 1;
            } else {
              scope.framegrabs.tabIndex = 0;
            }
          } else {
            if (scope.framegrabs.tabIndex !== 0) {
              scope.framegrabs.tabIndex -= 1;
            } else {
              scope.framegrabs.tabIndex = (scope.framegrabs.urls.length - 1);
            }
          }
        }
      };

      let config =
      {
        id: 'framegrabs',
        headerTitle: "Stills",
        position: attrs.position,
        theme: '#717171',
        panelSize: attrs.size,
        setpanelstate: 'minimized',
        onwindowresize: true,
        headerControls: {
          close: 'remove',
          maximize: 'remove',
          smallify: 'remove',
          size: 'xs'
        },
        onnormalized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: true });
          scope.$apply();

        },
        onminimized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: false });
        }
      };
      $rootScope.$on('framegrabs-nav', function (ev, direction) {
        scope.framegrabNav(direction);
      })

      $rootScope.$on('select-item', function () {
        delete scope.rating;
        detailsFactory.getFramegrabs().then(function (result) {
          scope.framegrabs = result;
          compileTemplate();
        }).catch(function () {
          console.log("Framegrabs Unavailable");
        })
      });

    }
  }
});

app.directive('scrollif', function ($location, $anchorScroll) {
  return function (scope, element, attrs) {
    scope.$watch(attrs.scrollif, function (value) {

      if (value === true) {
        console.log(element[0].id)
        $location.hash(element[0].id);
        $anchorScroll();
        $location.hash('');
        $location.replace();

      }
    });
  }
});

app.factory('activitySocketFactory', ['$rootScope', '$websocket', '$interval', '$timeout', function ($rootScope, $websocket, $interval, $timeout) {
  let ws;
  let reconnectTimer;
  let pingTimeout;
  function heartbeat() {
    $timeout.cancel(pingTimeout);
    pingTimeout = $timeout(function () {
      ws.close({ force: true });
    }, 30000 + 1000);
  }
  function connectSocket() {
    if (!ws) {
      console.log("Connecting Socket");
      ws = $websocket('wss://relay.abg.thomasfelder.com');
      ws.reconnectIfNotNormalClose = true;
      console.log(ws.socket.readyState);
    } else if (ws.socket.readyState !== 1) {
      console.log("Reconnecting Socket");
      ws.close({ force: true });
      ws = $websocket('wss://relay.abg.thomasfelder.com');
    }
  };
  connectSocket();
  ws.onOpen(function () {
    console.log('Socket Connected', ws.socket.readyState);
    heartbeat();
    if (reconnectTimer) {
      $interval.cancel(reconnectTimer);
    }
  });
  ws.onMessage(function (message) {
    let parsed = JSON.parse(message.data);
    if (parsed.channel === 'ping') {
      heartbeat();
      ws.send({ channel: 'pong', id: parsed.id });
    } else {
      $rootScope.$emit(parsed.channel, parsed);
    }
  });
  ws.onClose(function () {
    console.log("Socket Disconnected");
    reconnectTimer = $interval(connectSocket, 10000)
  });
  return {
    emit: function (channel, data) {
      ws.send({ channel: channel, data: data });
    }
  };
}]);

app.controller('chartController', function ($scope, $rootScope, detailsFactory, $localStorage) {
  function initChartOptions() {
    $scope.lineOption = {
      legend: {
        data: [],
        show: true
      },
      xAxis: {
        type: 'value',
        boundaryGap: false,
        data: [],
        axisLabel: {
          inside: false
        }
      },
      yAxis: {
        type: 'value',
        max: 30,
        axisLabel: {
          inside: true
        }
      },
      tooltip: {
        show: true,
        formatter: function (params) {
          return params.value[2];
        }
      },
      grid: {
        top: '25px',
        left: '25px',
        bottom: '25px',
        right: '55px'
      },
      series: []
    };

    $scope.lineConfig = {
      theme: 'catalogue',
      event: [{ click: onClick }],
      dataLoaded: true
    };
  };

  initChartOptions();

  function refreshChart(multiselect) {
    detailsFactory.getShots().then(function (shotdata) {
      if (($scope.lineOption.series.length) && (multiselect === true) && (shotdata.data.name !== $scope.lineOption.series[0].name)) {
        console.log("multiselect");
        //$scope.lineOption.xAxis.data = shotdata.data.labels;
        $scope.lineOption.legend.data.push(shotdata.data.name);
        $scope.lineOption.series.push({
          data: shotdata.data.data,
          name: shotdata.data.name,
          type: 'line',
          areaStyle: {
            color: lineStyles[$scope.lineOption.series.length - 1].fill,
          },
          lineStyle: {
            color: lineStyles[$scope.lineOption.series.length - 1].line,
            width: 2,
            type: 'solid'
          },
          itemStyle: {
            color: lineStyles[$scope.lineOption.series.length - 1].line
          },
          markLine: {
            silent: true,
            label: {
              backgroundColor: '#494949',
              color: '#bcbcbc',
              fontWeight: 800
            },
            data: [[
              {
                name: "ASL " + shotdata.asl.toFixed(1),
                xAxis: 'min',
                yAxis: shotdata.asl
              }, {
                xAxis: 'max',
                yAxis: shotdata.asl
              }
            ]]
          }
        })
      } else {
        if (shotdata.data) {
          if (shotdata.data.data) {
            //$scope.lineOption.xAxis.data = shotdata.data.labels;
            $scope.lineOption.legend.data = [(shotdata.data.name)];
            $scope.lineOption.series = [{
              data: shotdata.data.data,
              name: shotdata.data.name,
              type: 'line',
              areaStyle: {
                color: 'rgba(112, 112, 112, 0.1)',
              },
              lineStyle: {
                color: 'rgb(112, 112, 112)',
                width: 2,
                type: 'solid'
              },
              itemStyle: {
                color: ''
              },
              markLine: {
                silent: true,
                label: {
                  backgroundColor: '#494949',
                  color: '#bcbcbc',
                  fontWeight: 800
                },
                data: [[
                  {
                    name: "ASL " + shotdata.asl.toFixed(1),
                    xAxis: 'min',
                    yAxis: shotdata.asl
                  }, {
                    xAxis: 'max',
                    yAxis: shotdata.asl
                  }
                ]]
              }
            }]
          }
        } else {
          initChartOptions();
        }
      }
    }).catch(function (error) {
      console.log(error);
    });
  }

  $rootScope.$on('select-item', function (ev, multiselect) {
    //console.log(multiselect);
    if ($localStorage.panelVisibility.shots === true) {
      refreshChart((multiselect || false));
    };
  });

  $rootScope.$on('refresh-panel', function (ev, panel) {
    console.log(panel);
    if (panel.id === 'shots') {
      refreshChart(false);
    };
  });

  function onClick(params) {
    console.log(params);
  };
})

app.directive('shots', function ($compile, $http, $rootScope, detailsFactory) {
  return {
    restrict: 'E',
    scope: {
      //shots: '=',
      panelstate: "&?",
      visible: "="
    },
    link: function (scope, elem, attrs) {

      let templateHtml;
      let panel;

      function compileTemplate() {
        if (!panel) {
          panel = jsPanel.create(config);
          if (scope.visible === false) {
            panel.minimize();
          }
        };
        if (!templateHtml) {
          $http.get('partials/shots.html').then(function (response) {
            templateHtml = response.data;
            let html = $compile(templateHtml)(scope);
            panel.contentRemove();
            panel.content.append(html[0]);
          });
        } else {
          let html = $compile(templateHtml)(scope);
          panel.contentRemove();
          panel.content.append(html[0]);
        }

      };

      let config = {
        id: 'shots',
        headerTitle: "ASL",
        position: attrs.position,
        theme: '#717171',
        panelSize: attrs.size,
        setpanelstate: 'minimized',
        onwindowresize: true,
        resizeit: {
          //aspectRatio: 'content'
        },
        headerControls: {
          close: 'remove',
          maximize: 'remove',
          smallify: 'remove',
          size: 'xs'
        },
        onnormalized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: true });
          scope.$apply();

        },
        onminimized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: false });
        }
      };

      compileTemplate();
      scope.noChartData = false;
      $rootScope.$on('select-item', function (ev, data) {
        detailsFactory.getShots().then(function (shotdata) {
          if ((data === false) && (!shotdata.data)) {
            scope.noChartData = true;
          } else {
            scope.noChartData = false;
          }
        }).catch(function () {
          scope.noChartData = true;
          console.log("Shot Data Unavailable");
        })
      });


    }
  }
});

app.directive('activity', function ($compile, $http, $rootScope, activitySocketFactory) {
  return {
    restrict: 'E',
    scope: {
      item: '=',
      panelstate: "&?",
      visible: "="
    },
    link: function (scope, elem, attrs) {

      let templateHtml;
      let panel;

      function refreshTasks() {
        $http.get('https://relay.abg.thomasfelder.com/tasks/active').then(function (response) {
          scope.activeTasks = response.data;
        });
      };
      refreshTasks();
      $rootScope.$on("activity", function (ev, socketmsg) {
        if (scope.activeTasks) {
          taskIndex = scope.activeTasks.findIndex(function (x) {
            if (x.uuid === socketmsg.uuid) {
              return true;
            }
          });
          if (taskIndex > -1) {
            Object.keys(socketmsg.data).forEach(function (property) {
              scope.activeTasks[taskIndex].data[property] = socketmsg.data[property];
              scope.$apply();
              //console.log(scope.activeTasks);
            });
          } else {
            refreshTasks();
          }
        };
      });

      $rootScope.$on("task-exit", function (ev, socketmsg) {
        //refreshTasks();
        let taskIndex = scope.activeTasks.findIndex(x => (x.uuid === socketmsg.uuid));
        scope.activeTasks.splice(taskIndex, 1);
        scope.$apply();
      });

      function compileTemplate() {
        if (!panel) {
          panel = jsPanel.create(config);
          if (scope.visible === false) {
            panel.minimize();
          }
        };
        if (!templateHtml) {
          $http.get('partials/activity.html').then(function (response) {
            templateHtml = response.data;
            let html = $compile(templateHtml)(scope);
            panel.contentRemove();
            panel.content.append(html[0]);
          });
        } else {
          let html = $compile(templateHtml)(scope);
          panel.contentRemove();
          panel.content.append(html[0]);
        }

      };


      let config =
      {
        id: 'activity',
        headerTitle: "Activity",
        position: attrs.position,
        theme: '#717171',
        panelSize: attrs.size,
        setpanelstate: 'minimized',
        onwindowresize: true,
        headerControls: {
          close: 'remove',
          maximize: 'remove',
          smallify: 'remove',
          size: 'xs'
        },
        onnormalized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: true });
          scope.$apply();

        },
        onminimized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: false });
        }
      };

      compileTemplate();

      scope.$on('socket:activity', function (ev, data) {
        console.log(data);
      });

    }
  }
});

app.directive('subtitles', function ($compile, $http, $rootScope, machineFactory, activitySocketFactory, $mdDialog, detailsFactory, $q) {
  return {
    restrict: 'E',
    scope: {
      //item: '=',
      //opensubtitles: '=',
      //localsubtitles: '=',
      panelstate: "&?",
      visible: "=",
      theme: "="
    },
    link: function (scope, elem, attrs) {

      let templateHtml;
      let panel;
      scope.gangTimecode;
      let gangMachine;

      scope.tabIndex = 0;
      scope.timeshift = {
        delay: 0,
        runtime: 100
      };


      let config =
      {
        id: 'subtitles',
        headerTitle: "Subtitles",
        position: attrs.position,
        theme: '#717171',
        panelSize: attrs.size,
        setpanelstate: 'minimized',
        onwindowresize: true,
        headerControls: {
          close: 'remove',
          maximize: 'remove',
          smallify: 'remove',
          size: 'xs'
        },
        onnormalized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: true });
          scope.$apply();

        },
        onminimized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: false });
        },
        resizeit: {
          stop: (panel, paneldata, event) => {
            if (scope.tabIndex === 1) {
              compileTemplate();
            }
          }
        }
      };


      function initializePanel() {
        return $q(function (resolve, reject) {
          if (!templateHtml) {
            $http.get('partials/subtitles.html').then(function (response) {
              templateHtml = response.data;
              resolve()

            });
          }
          if (!panel) {
            panel = jsPanel.create(config).minimize();
          }
        })
      }


      function compileTemplate() {
        initializePanel().then(function () {

          if (!scope) {
            let scope = $rootScope.$new();
          };
          let html = $compile('<div flex class="subtitles-content" layout="column" layout-align="start stretch">\
                <div flex="100" class="subtitles-missing-container" layout="column" layout-align="center center">\
                  <div class="subtitles-missing-container">\
                    <span class="material-icons data-missing-icon">subtitles_off</span>\
                  </div>\
                  <div class="panel-element subtitles-title"><span id="missing-subtitles-title" class="missing-data">Subtitles Unavailable</span></div>\
                </div>')(scope);
          panel.content.append(html[0]);


          panel.contentRemove();
          panel.content.append(html[0]);


        })
      };




      $rootScope.$on('select-item', function (ev, data) {
        delete scope.analyzedSubtitltes;
        delete scope.parsedSubs;
        delete scope.selected;
        if (scope.subtitles) {
          delete scope.subtitles.opensubtitles;
          delete scope.subtitles.localsubtitles;
        }
        scope.tabIndex = 0;
        detailsFactory.getItem().then(function (item) {
          scope.item = item;
        });
        detailsFactory.getSubtitles().then(function (data) {
          scope.subtitles = data;
          compileTemplate();
        }).catch(function () {
          console.log("Subtitles Unavailable")
          compileTemplate();
        });
      });



      function refreshLocalSubtitles() {
        $http.post('https://subs.abg.thomasfelder.com/localsubtitles', { title: scope.item._source.title, path: scope.item._source.path }).then(function (response) {
          scope.subtitles.localsubtitles = response.data;
        }).catch(function (error) {
          console.log(error);
        });
      };

      scope.jumpToTime = function (timecode) {
        let timeInSeconds = Math.floor(timecode / 1000);
        machineFactory.sendCommand(gangMachine, 'seek&val=' + timeInSeconds).then(function (responsecode) {
          console.log("sent command seek&val=" + timeInSeconds + " to " + gangMachine + " " + responsecode);
        });
      };

      scope.processSubs = function (sub, index) {
        delete scope.parsedSubs;
        let data = {
          title: scope.item._source.title,
          id: scope.item._id,
          path: scope.item._source.path
        };
        if (sub.url) {
          data.url = sub.url;
          data.sub = sub;
          scope.selected = { id: index, type: 'external' };
        } else {
          data.srtfile = sub;
          scope.selected = { id: index, type: 'local' };
        }
        console.log(data);
        $http.post('https://subs.abg.thomasfelder.com/subs/fetch', data).then(function (response) {
          scope.parsedSubs = response.data;
          //console.log(response.data);
          scope.tabIndex = 1;
          refreshLocalSubtitles();
        });
      };

      scope.deleteLocalSub = function (file, index) {
        let confirm = $mdDialog.confirm()
          .title('Delete SRT File')
          .htmlContent('<p class="prompt-delete">Delete <span class="subtitle-file">' + file + '</span>?</p>')
          .ariaLabel('Delete Subtitle')
          .theme(scope.theme)
          .ok('Yes')
          .cancel('No');

        $mdDialog.show(confirm).then(function () {
          let data = {
            file: file
          };
          $http.post('https://subs.abg.thomasfelder.com/subs/delete', data).then(function (response) {
            scope.subtitles.localsubtitles = scope.subtitles.localsubtitles.splice(1, index);
          });
        }, function () {

        });
      };

      scope.analyzeSubtitltes = function () {
        let data = {
          path: scope.item._source.path + '/' + scope.item._source.title + '.srt',
          title: scope.item._source.title
        };
        if (scope.selected.type === 'local') {
          data.path = scope.subtitles.localsubtitles[scope.selected.id].file
        }
        $http.post('https://subs.abg.thomasfelder.com/subs/analyze', data).then(function (response) {
          scope.analyzedSubtitltes = response.data;
        });
      };

      scope.isActive = function (startMs, endMs) {
        if ((scope.gangTimecode >= (startMs - 1000)) && (scope.gangTimecode <= endMs)) {
          return true;
        }
        return false;
      };

      $rootScope.$on("gangSync", function (event, data) {
        if (scope.tabIndex === 1) {
          if (scope.gangTimecode !== data.timems) {
            console.log(scope.gangTimecode, data);
            scope.gangTimecode = data.timems;
            gangMachine = data.machine;
            scope.parsedSubs.next = scope.parsedSubs.findIndex(function (x) {
              if ((x.startTimeMs * (scope.timeshift.runtime / 100)) >= (data.timems + (scope.timeshift.delay))) {
                return true;
              }
            });
            scope.parsedSubs.top = scope.parsedSubs.next - 2;
          }
        }
      });

    }
  }
});

app.directive('discmetadata', function ($rootScope, $compile, $http, detailsFactory) {
  return {
    restrict: 'E',
    scope: {
      panelstate: "&?",
      visible: "="
    },
    link: function (scope, elem, attrs) {

      let templateHtml;
      let panel;

      $http.get('partials/discmetadata.html').then(function (response) {
        templateHtml = response.data;
      });

      function compileTemplate() {
        if (!panel) {
          panel = jsPanel.create(config);
          if (scope.visible === false) {
            panel.minimize();
          }
        }
        let html = $compile(templateHtml)(scope);
        panel.contentRemove();
        panel.content.append(html[0]);
      }

      function initPanel() {
        if (!panel) {
          panel = jsPanel.create(config);
          if (scope.visible === false) {
            panel.minimize();
          }
        }
        //let scope = $rootScope.$new();
        let html = $compile('<div flex class="discmetadata-content" layout="column" layout-align="start stretch" ng-if="!discmetadata">\
            <div flex="100" class="discmetadata-missing-container" layout="column" layout-align="center center">\
              <div class="discmetadata-missing-container">\
                <div class="loading-spinner"></div>\
              </div>\
            </div>\
          </div>')(scope);
        //scope.$destroy();
        panel.content.append(html[0]);
      }

      let config =
      {
        id: 'discmetadata',
        headerTitle: "Disc",
        position: attrs.position,
        theme: '#717171',
        panelSize: attrs.size,
        setpanelstate: 'minimized',
        onwindowresize: true,
        headerControls: {
          close: 'remove',
          maximize: 'remove',
          smallify: 'remove',
          size: 'xs'
        },
        onnormalized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: true });
          scope.$apply();

        },
        onminimized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: false });
        }
      };

      scope.$watch('visible', function () {
        if (typeof scope.visible !== 'undefined') {
          initPanel();
        }
      });


      $rootScope.$on("select-item", function (ev, data) {
        console.log("Fetching Disc Metadata")
        delete scope.discmetadata;
        detailsFactory.getItem().then(function (item) {
          scope.id = item._id;
          scope.path = item._source.path;
          scope.mediatype = item._source.mediatype
        });
        detailsFactory.getDiscMetadata().then(function (discmetadata) {
          scope.discmetadata = discmetadata;
          //console.log(discmetadata);
          compileTemplate();
        }).catch(function (err) {
          console.log("Disc Metadata Unavailable");
          compileTemplate();
        })
      });

    }
  }
});

app.directive('moviemetadata', function ($rootScope, $compile, $http, detailsFactory, $timeout) {
  return {
    restrict: 'E',
    scope: {
      panelstate: "&?",
      visible: "="
    },
    link: function (scope, elem, attrs) {

      let templateHtml;
      let panel;

      $http.get('partials/moviemetadata.html').then(function (response) {
        templateHtml = response.data;
      });

      function compileTemplate() {

        if (!panel) {
          panel = jsPanel.create(config);
          if (scope.visible === false) {
            panel.minimize();
          }
        }
        panel.contentRemove();
        let html = $compile(templateHtml)(scope);
        //console.log(html[0]);
        panel.content.append(html[0]);

      }

      function initPanel() {
        if (!panel) {
          panel = jsPanel.create(config);
          if (scope.visible === false) {
            panel.minimize();
          }
        }
        //let scope = $rootScope.$new();
        let html = $compile('<div flex class="moviemetadata-content" layout="column" layout-align="start stretch">\
            <div ng-if="!movie._id" class="no-moviemetadata" layout="column" layout-align="center center">\
              <div class="panel-element moviemetadata-title"><span id="no-moviemetadata-title" class="missing-data">Movie not in Catalogue</span></div>\
            </div>\
          </div>\
          ')(scope);
        //scope.$destroy();
        panel.contentRemove();
        panel.content.append(html[0]);
      }

      let config =
      {
        id: 'moviemetadata',
        headerTitle: "Info",
        position: attrs.position,
        theme: '#717171',
        panelSize: attrs.size,
        setpanelstate: 'minimized',
        onwindowresize: true,
        headerControls: {
          close: 'remove',
          maximize: 'remove',
          smallify: 'remove',
          size: 'xs'
        },
        onnormalized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: true });
          detailsFactory.getItem().then(function (item) {
            scope.movie = item;
            $timeout(function () {
              compileTemplate();
            });
          });
        },
        onminimized: function (panel, status) {
          scope.panelstate({ id: panel.id, visible: false });
        }
      };

      scope.$watch('visible', function () {
        if (typeof scope.visible !== 'undefined') {
          initPanel();
        }
      });


      $rootScope.$on("select-item", function (ev, data) {
        console.log("Fetching Movie Metadata")
        detailsFactory.getItem().then(function (item) {
          scope.movie = item;
          $timeout(function () {
            compileTemplate();
          });
        });
      });
    }
  }
});

app.directive('remote', function ($rootScope, $compile, $http, machineFactory, $interval, $q) {
  return {
    restrict: 'E',
    scope: {
      panelstate: "&?",
      visible: "="
    },
    link: function (scope, elem, attrs) {

      let templateHtml;
      let panel;

      scope.selectMachine = function (machine) {
        scope.selectedMachine = machine;
        //console.log(scope.selectedMachine.name,scope.playlist);
      };

      scope.gangSync = false;

      function addSelectorToHeader() {
        let selectorhtml = '<select ng-model="selectedMachine" class="machine-selector">\
              <option ng-repeat="machine in machines" ng-value="machine" ng-bind="machine.name"></option>\
          </select>';
        panel.setHeaderTitle($compile(selectorhtml)(scope)[0]);
      };

      function initializePanel() {
        return $q(function (resolve, reject) {
          if (!panel) {
            if (!scope.machines) {
              machineFactory.getMachineList().then(function (result) {
                scope.machines = result;
                scope.selectedMachine = scope.machines[scope.machines.findIndex(function (x) {
                  if (x.isyou === true) {
                    return true;
                  }
                }) || 0];
                console.log("client identified: ", scope.selectedMachine);
                if (!scope.selectedMachine) {
                  scope.selectedMachine = scope.machines[0];
                };
                panel = jsPanel.create(config);
                addSelectorToHeader();
                if (scope.visible === false) {
                  panel.minimize();
                } else {
                  getPlaylist();
                  startPolling();
                }
                resolve();

              });
            } else {
              panel = jsPanel.create(config);
              if (scope.visible === false) {
                panel.minimize();
              } else {
                getPlaylist();
                startPolling();
              }
              resolve()

            }
          }
        })

      }

      function compileTemplate() {
        initializePanel().then(function () {
          if (!templateHtml) {
            $http.get('partials/remote.html').then(function (response) {
              templateHtml = response.data;
              let html = $compile(templateHtml)(scope);
              panel.contentRemove();
              panel.content.append(html[0]);
            });
          } else {
            let html = $compile(templateHtml)(scope);
            panel.contentRemove();
            panel.content.append(html[0]);
          }
        })
      };

      let config = {
        id: 'remote',
        headerTitle: "Remote",
        position: attrs.position,
        theme: '#717171',
        panelSize: attrs.size,
        setpanelstate: 'minimized',
        onwindowresize: true,
        resizeit: {
          minWidth: 70,
          minHeight: 115,
          maxHeight: 190
        },
        headerControls: {
          close: 'remove',
          maximize: 'remove',
          smallify: 'remove',
          size: 'xs'
        },
        onnormalized: function (panel, status) {
          addSelectorToHeader();
          scope.panelstate({ id: panel.id, visible: true });
          getPlaylist();
          startPolling();
          scope.$apply();
        },
        onminimized: function (panel, status) {
          panel.setHeaderTitle("Remote");
          scope.panelstate({ id: panel.id, visible: false });
          stopPolling();
        }
      };

      scope.$watch('selectedMachine', function (oldVal, newVal) {
        if (newVal) {
          machineFactory.selectMachine(scope.selectedMachine).then(function (result) {
            console.log(result);
          })
        };
      }, true);

      scope.$watch('visible', function () {
        if (typeof scope.visible !== 'undefined') {
          compileTemplate();
        }
      });

      let poller;

      function getPlaylist() {
        machineFactory.getVlcPlaylist(scope.selectedMachine.name).then(function (vlcPlaylist) {
          scope.playlist = vlcPlaylist;
          console.log(scope.playlist);
        })
      };

      function getVlcStatus() {
        machineFactory.getVlcStatus(scope.selectedMachine.name).then(function (vlcStatus) {
          if (scope.playback) {
            if (scope.playback.time !== vlcStatus.time) {
              scope.playback = vlcStatus;
              if ((scope.gangSync === true) && (scope.playback.time)) {
                $rootScope.$broadcast("gangSync", { time: scope.playback.time, timems: (scope.playback.time * 1000), length: scope.playback.length, machine: scope.selectedMachine.name });
              }
            } else {
              scope.playback.state = vlcStatus.state;
            }
          } else {
            scope.playback = vlcStatus;

            if ((scope.gangSync === true) && (scope.playback.time)) {
              $rootScope.$broadcast("gangSync", { time: scope.playback.time, timems: (scope.playback.time * 1000), length: scope.playback.length, machine: scope.selectedMachine.name });

            }
          }
        })
      };

      function startPolling() {
        stopPolling();
        console.log("start polling " + scope.selectedMachine.name);
        poller = $interval(getVlcStatus, 1000);
      };
      function stopPolling() {
        console.log("stop polling " + scope.selectedMachine.name);
        $interval.cancel(poller);
      };
      scope.stopPolling = function () {
        console.log("slider stop polling");
        stopPolling();
      };
      scope.startPolling = function () {
        console.log("slider start polling");
        console.log(scope.playback.time);
        machineFactory.sendCommand(scope.selectedMachine.name, 'seek&val=' + Math.round((scope.playback.time / scope.playback.length) * 100) + '%25').then(function (responsecode) {
          startPolling();
        })
      };
      scope.togglePlaybackState = function () {
        if (scope.playback.state === 'paused') {
          scope.playback.state = 'playing';
        } else {
          scope.playback.state = 'paused';
        };
      };
      scope.sendCommand = function (command) {
        machineFactory.sendCommand(scope.selectedMachine.name, command).then(function (responsecode) {
          console.log("sent command " + command + " to " + scope.selectedMachine.name + " " + responsecode);
          if (command === 'snapshot') {
            let title = scope.playlist.children[0].children[0].uri.split('/')[7];
            $rootScope.$broadcast("refresh-snapshot", title);
          };
        });
      };
      scope.toggleGangSync = function () {
        scope.gangSync = !scope.gangSync;
        console.log("gang sync: " + scope.gangSync);
        $rootScope.$broadcast("gangSync", { time: scope.playback.time, timems: (scope.playback.time * 1000), length: scope.playback.length, machine: scope.selectedMachine.name });
      }
      scope.dvdCommand = function (dvdcmd) {
        machineFactory.getSelectedMachine().then(function (machine) {
          $http.get('/api/dvd/' + machine.name + '/' + dvdcmd).then(function (response) {
            console.log(machine.name + ": " + dvdcmd, response.data);
          });
        }).catch(function () {
          console.log("no machine selected in remote");
        })
      };

    }
  }
});

app.filter('roundTo', function (numberFilter) {
  return function (value, maxDecimals) {
    if (!isNaN(value)) {
      return numberFilter((value || 0)
        .toFixed(maxDecimals)
        .replace(/(?:\.0+|(\.\d+?)0+)$/, "$1")
      ) + 's';
    }
    return '-'

  }
});

app.filter('theFilter', function () {
  return function (input) {
    if (input) {
      if (input.substring(0, 4) === 'The ') {
        return input.replace('The ', '<span class="article">The </span>');
      }
      return input;
    }
  }
});

app.filter('formatReleaseDate', function () {
  return function (input) {
    //console.log(input, moment(input, 'YYYY-mm-DD').format('YYYY-mm-DD'))
    return moment(input, 'YYYY-mm-DD').format('YYYY');
  }
});

app.filter('rangeincludes', function () {
  return function (rangeA, rangeB) {
    return Math.abs(rangeB - rangeA) + 1;
  }
});

app.filter('runtime', function (moment) {
  return function (seconds) {
    //console.log(seconds);
    return moment(seconds * 1000).utc().format('HH:mm:ss');
  }
});

app.filter('msTimecode', function (moment) {
  return function (ms) {
    return moment(ms).utc().format('HH:mm:ss');
  }
});

app.factory('sizeWatcher', ['$interval', function ($interval) {
  return function (element, rate) {
    let self = this;
    (self.update = function () { self.dimensions = [element.offsetWidth, element.offsetHeight]; })();
    self.monitor = $interval(self.update, rate);
    self.group = [function () { return self.dimensions[0]; }, function () { return self.dimensions[1]; }];
    self.cancel = function () { $interval.cancel(self.monitor); };
  };
}]);

app.factory('elasticsearchFactory', function ($rootScope, $http, $q, $localStorage) {
  let currentCatalogueData;
  let catalogueCopy;
  let stats;
  let currentQueryData;
  let sortOptions;
  let _self = this;
  let currentQuery;
  let videoCatPromise;
  let initial = true;
  let factory = {};

  function updateStats(data) {
    stats = {
      titles: data.hits.titles,
      discs: data.hits.total.value,
      aggregations: data.aggregations.media.buckets
    }
  }

  function dynamicSort(prop, arr, order) {
    prop = prop.split('.');
    let len = prop.length;

    arr.sort(function (a, b) {
      let i = 0;

      while (i < len) {
        a = a[prop[i]] || "";
        b = b[prop[i]] || "";
        if (a.length) {
          a = a.replace('The ', '');
        };
        if (b.length) {
          b = b.replace('The ', '');
        };
        i++;
      }
      if (a < b) {
        return -1;
      } else if (a > b) {
        return 1;
      } else {
        return 0;
      }
    });
    if (order === "desc") {
      return arr.reverse();
    } else {
      return arr;
    };
  };

  factory.search = function (query, reload, allfields, filterName) {

    if ((!videoCatPromise) || (videoCatPromise.$$state.status !== 0)) {
      videoCatPromise = $q(function (resolve, reject) {

        if (!query) {
          query = '';
        };

        function queryEs() {
          currentQuery = query;
          currentQueryData = {
            searchterm: query,
            sort: $localStorage.sortOptions
          };
          if (allfields === true) {
            currentQueryData.allfields = true;
          };

          let postParams = {
            method: 'POST',
            url: '/api/videocat',
            eventHandlers: {
              progress: function (e) {
                //console.log(Math.round((e.loaded/e.total)*100)+"%");
                $rootScope.$broadcast('initialLoading', { statusText: "Loading Index...", total: e.total, loaded: e.loaded, progress_percent: Math.round((e.loaded / e.total) * 100) });

              }
            },
            data: currentQueryData
          };

          $rootScope.$broadcast('initialLoading', { statusText: "Requesting Catalogue..." });

          $http(postParams).then(function (response) {
            currentCatalogueData = response.data;
            if (initial === true) {
              catalogueCopy = JSON.parse(JSON.stringify(currentCatalogueData));
              initial = false;
            };

            updateStats(response.data);
            sortOptions = JSON.parse(JSON.stringify($localStorage.sortOptions));
            resolve(response.data);
          }).catch(function (error) {
            reject(error);
          });
        };

        console.log($localStorage.sortOptions);

        let sortKey
        let sortOrder
        let previousSortKey
        let previousSortOrder

        if (typeof sortOptions !== 'undefined') {
          sortKey = Object.keys($localStorage.sortOptions)[0];
          sortOrder = $localStorage.sortOptions[sortKey].order;
          previousSortKey = Object.keys(sortOptions)[0];
          previousSortOrder = sortOptions[previousSortKey][0]
        };

        if ((currentCatalogueData) && (reload === false) && (!($localStorage.sortOptions.writer || $localStorage.sortOptions.editor))) {
          if ((query === currentQuery) && (Object.keys($localStorage.sortOptions)[0] === previousSortKey)) {
            //reverse sort
            console.log(sortOptions, $localStorage.sortOptions)
            currentCatalogueData.hits.hits = currentCatalogueData.hits.hits.reverse()

            let sortKey = Object.keys($localStorage.sortOptions)[0]
            let sortOrder = $localStorage.sortOptions[Object.keys($localStorage.sortOptions)[0]].order;

            if (sortOrder === 'asc'){
              sortOrder = 'desc'
            } else {
              sortOrder = 'asc'
            }
            let newSortOptions = {}

            newSortOptions[Object.keys($localStorage.sortOptions)[0]] = {
              "order": sortOrder
            }

            $localStorage.sortOptions = newSortOptions;
            $localStorage.sortOrder = sortOrder;

            resolve(currentCatalogueData);
          } else if (query === currentQuery) {
            currentCatalogueData.hits.hits = dynamicSort('_source.' + sortKey.replace('.keyword', ''), currentCatalogueData.hits.hits, $localStorage.sortOptions[sortKey].order);
            sortOptions = JSON.parse(JSON.stringify($localStorage.sortOptions));
            resolve(currentCatalogueData);
          } else if (filterName) {
            console.log("name filter query...");
            let filteredCatalogue = JSON.parse(JSON.stringify(catalogueCopy));
            filteredCatalogue.hits.hits.filter(function (catalogueItem) {
              if (catalogueItem._source.crew) {
                let filteredCrew = catalogueItem._source.crew.filter(function (crewMember) {
                  if (crewMember.name === filterName) {
                    return true
                  };
                  return false;
                });
                if (filteredCrew.length) {
                  return true;
                } else {
                  return false;
                }
              };
              return false;
            });

            resolve(filteredCatalogue);
          } else {
            //queryEs();
            console.log("this was a query reset");
            currentCatalogueData.hits.hits = dynamicSort('_source.' + sortKey.replace('.keyword', ''), catalogueCopy.hits.hits, $localStorage.sortOptions[sortKey].order);
            catalogueCopy = JSON.parse(JSON.stringify(currentCatalogueData))
            resolve(catalogueCopy);
          };
        } else {
          queryEs();
        }

      });
    }
    return videoCatPromise;
  };
  factory.currentCatalogueData = function () {
    return $q(function (resolve, reject) {

      if (currentCatalogueData) {
        resolve(currentCatalogueData);
      } else {
        factory.search().then(function (data) {
          resolve(currentCatalogueData);
        })
      }
    })
  };
  factory.getAggs = function () {
    return $q(function (resolve, reject) {

      if (stats) {
        resolve(stats);
      } else {
        factory.search().then(function () {
          resolve(stats);
        })
      }
    })
  };
  factory.copyCatUpdate = function (item) {
    return $q(function (resolve, reject) {
      let existingIndex = currentCatalogueData.hits.hits.findIndex(x => x._id === item._id);
      if (existingIndex > -1) {
        console.log("updated currentCatalogueData item at index: " + existingIndex)
        currentCatalogueData.hits.hits[existingIndex] = item;
      };

      let existingIndexCopy = catalogueCopy.hits.hits.findIndex(x => x._id === item._id);
      if (existingIndexCopy > -1) {
        console.log("updated catalogueCopy item at index: " + existingIndexCopy)
        catalogueCopy.hits.hits[existingIndexCopy] = item;
      };
      resolve("updated in-memory catalogue item")

    })
  };
  factory.addKeyValueToDoc = function (key, value, doc) {
    let docIndex = currentCatalogueData.hits.hits.findIndex(x => (x._id === doc));
    if (docIndex !== -1) {
      console.log("Adding " + key + " to " + doc);
      currentCatalogueData.hits.hits[docIndex]._source[key] = value;
    }
  };
  factory.getValueFromDoc = function (itemkey, doc) {
    return $q(function (resolve, reject) {
      let docIndex = currentCatalogueData.hits.hits.findIndex(x => (x._id === doc));
      if (docIndex > -1) {
        if (currentCatalogueData.hits.hits[docIndex]._source[itemkey]) {
          resolve(currentCatalogueData.hits.hits[docIndex]._source[itemkey]);
        } else {
          console.log(Object.keys(currentCatalogueData.hits.hits[docIndex]._source));

          reject("key not found");
        }
      } else {
        reject(docIndex);
      }
    })
  };

  $rootScope.$on("catalogue", function (ev, socketmsg) {
    console.log(socketmsg);
    if (socketmsg.action === "Added") {
      if (currentCatalogueData) {
        let newDiskObject = {
          _id: socketmsg.es._id,
          _source: socketmsg.data
        }

        let existingIndex = currentCatalogueData.hits.hits.findIndex(x => x._id === socketmsg.es._id)

        if (existingIndex === -1) {
          //figue out how to refresh virtual-repeat
          console.log("Added disk...", newDiskObject);
          currentCatalogueData.hits.hits.push(newDiskObject);
          catalogueCopy.hits.hits.push(newDiskObject);
          //re-sort
          let sortKey = Object.keys($localStorage.sortOptions)[0];
          currentCatalogueData.hits.hits = dynamicSort('_source.' + sortKey.replace('.keyword', ''), currentCatalogueData.hits.hits, $localStorage.sortOptions[sortKey].order);
          catalogueCopy.hits.hits = dynamicSort('_source.' + sortKey.replace('.keyword', ''), catalogueCopy.hits.hits, $localStorage.sortOptions[sortKey].order);

          //$rootScope.$emit('catalogue-updated', newDiskObject);
        }

      };
    } else if (socketmsg.action === "Removed") {
      if (currentCatalogueData) {
        let itemToDelete = currentCatalogueData.hits.hits.findIndex(x => x._source.path === socketmsg.path);
        if (itemToDelete > -1) {
          currentCatalogueData.hits.hits.splice(itemToDelete, 1);
        }
        let itemCopyToDelete = catalogueCopy.hits.hits.findIndex(x => x._source.path === socketmsg.path);
        if (itemCopyToDelete > -1) {
          catalogueCopy.hits.hits.splice(catalogueCopy, 1);
        }
        $rootScope.$emit('catalogue-updated');

      }
    }
  });

  return factory;
});

app.factory('detailsFactory', function ($rootScope, $http, $q, $localStorage, elasticsearchFactory) {
  let factory = {};
  let item = {
    details: {},
    data: {},
  };
  fetchingDiscMetadata = true;

  factory.setItemByName = function (movieName) {
    elasticsearchFactory.currentCatalogueData().then(function (catalogueData) {
      let indexInCatalogue = catalogueData.hits.hits.findIndex(x => (x._source.title === movieName));
      console.log("Setting selected item " + movieName + " at index: " + indexInCatalogue);

      if (indexInCatalogue !== -1) {
        $localStorage.selection.selectedItem = indexInCatalogue;
        $localStorage.selection.topItem = (indexInCatalogue - 5);
        factory.setItem(catalogueData.hits.hits[indexInCatalogue]).then(function () {
          $rootScope.$broadcast("select-item", false);
        })
      }
    })
  };

  factory.setItem = function (itemData) {
    return $q(function (resolve, reject) {
      item.data = itemData;
      item.id = item.data._id;
      resolve()
    })
  }

  factory.itemId = function () {
    return item.data._id
  };

  factory.getItem = function () {
    return $q(function (resolve, reject) {
      if (item.data._id) {
        resolve(item.data);
      } else {
        elasticsearchFactory.currentCatalogueData().then(function (catalogueData) {
          //console.log(catalogueData.hits.hits[$localStorage.selection.selectedItem||0])
          factory.setItem(catalogueData.hits.hits[$localStorage.selection.selectedItem || 0]).then(function () {
            $rootScope.$broadcast("select-item", false);
          })
          resolve(catalogueData.hits.hits[$localStorage.selection.selectedItem || 0])
        })
      }
    })
  }

  factory.getBbfc = function () {
    return $q(function (resolve, reject) {
      if (item.data._source) {
        if (item.data._source.bbfc) {
          resolve(item.data._source.bbfc);
        } else {
          $http.post('/api/details/bbfc', item.data).then(function (response) {
            if (typeof response.data === 'object') {
              item.data._source.bbfc = response.data;
              resolve(item.data._source.bbfc);
            } else {
              reject();
            }
          }).catch(function (error) {
            reject(error);
          });
        }
      } else {
        reject();
      }
    })
  };

  factory.getMpaa = function () {
    return $q(function (resolve, reject) {
      if (item.data._source) {
        if (item.data._source.mpaa) {
          resolve(item.data._source.mpaa);
        } else {
          $http.post('/api/details/mpaa', item.data).then(function (response) {
            if (typeof response.data === 'object') {
              item.data._source.mpaa = response.data;
              resolve(item.data._source.mpaa);
            } else {
              reject();
            }
          }).catch(function (error) {
            reject(error);
          });
        }
      } else {
        reject();
      }
    })
  };
  4
  factory.getFramegrabs = function () {
    return $q(function (resolve, reject) {
      $http.post('/api/details/framegrabs', item.data).then(function (response) {
        resolve(response.data);
      }).catch(function (error) {
        reject(error);
      });
    })
  };

  factory.getShots = function () {
    return $q(function (resolve, reject) {
      $http.get('/api/details/shots/' + item.data._id).then(function (response) {
        if (response.data) {
          let graphdata = {
            data: response.data,
            asl: item.data._source.asl_seconds,
            shots: item.data._source.number_of_shots,
          }
          resolve(graphdata);
        } else {
          reject("Shot data unavailable...", item.data);
        };
      }).catch(function (error) {
        reject("Shot data API error...", error);
      });
    })
  };

  factory.getSubtitles = function () {
    return $q(function (resolve, reject) {
      let subtitles = {};
      $http.post('https://subs.abg.thomasfelder.com/localsubtitles', { title: item.data._source.title, path: item.data._source.path }).then(function (response) {
        subtitles.localsubtitles = response.data;
        $http.get('https://subs.abg.thomasfelder.com/opensubtitles/' + item.data._source.title).then(function (response) {
          if (Object.keys(response.data)) {
            subtitles.opensubtitles = response.data;
            resolve(subtitles);
          } else {
            reject(error);
          }
        }).catch(function (error) {
          reject(error);
        });
      }).catch(function (error) {
        reject(error);
      });

    })
  };

  factory.getDiscMetadata = function () {
    return $q(function (resolve, reject) {
      elasticsearchFactory.getValueFromDoc('discmetadata', item.data._id).then(function (discmetadata) {
        console.log(discmetadata);
        resolve(discmetadata);
      }).catch(function (err) {
        console.log(err);
        $http.post('/api/details/discmetadata', item.data).then(function (response) {
          if (typeof response.data === 'object') {
            elasticsearchFactory.addKeyValueToDoc('discmetadata', response.data, item.data._id);
            console.log(response.data)
            resolve(response.data);
          } else {
            reject("Disc Metadata could not be read.");
          }
        }).catch(function (error) {
          reject(error);
        });
      })
    })
  };

  return factory;
});

app.factory('machineFactory', function ($http, $q) {
  let lastPolledMachine;
  let selectedMachine;
  let machineList;
  let factory = {};


  factory.getMachineList = function () {
    return $q(function (resolve, reject) {
      if (machineList) {
        resolve(machineList);
      } else {
        $http.get('/api/machines').then(function (response) {
          machineList = response.data;
          resolve(response.data);
        }).catch(function (err) {
          reject(err);
        });
      };
    });
  };

  factory.selectMachine = function (machine) {
    return $q(function (resolve, reject) {
      if (machine) {
        if (machine.name) {
          selectedMachine = machine;
          resolve(selectedMachine);
        } else {
          resolve()
        };
      } else {
        resolve()
      };
    })
  };

  factory.getSelectedMachine = function () {
    return $q(function (resolve, reject) {
      if (selectedMachine) {
        if (selectedMachine.name) {
          resolve(selectedMachine);
        } else {
          reject()
        };
      } else {
        factory.getMachineList().then(function (machineList) {
          let thisMachine = machineList.findIndex(x => x.isyou === true) || 0;
          selectedMachine = machineList[thisMachine];
          console.log("client identified: ", selectedMachine);
          resolve(selectedMachine)
        });
      };
    })
  };

  factory.getVlcStatus = function (machine) {
    lastPolledMachine = machine;
    return $q(function (resolve, reject) {
      $http.get('/api/machine/' + machine).then(function (response) {
        resolve(response.data);
      }).catch(function (err) {
        reject(err);
      });
    })
  };

  factory.getVlcPlaylist = function (machine) {
    lastPolledMachine = machine;
    return $q(function (resolve, reject) {
      $http.get('/api/playlist/' + machine).then(function (response) {
        resolve(response.data);
      }).catch(function (err) {
        reject(err);
      });
    })
  };

  factory.sendCommand = function (machine, command) {
    return $q(function (resolve, reject) {

      if ((typeof machine === 'undefined') && (typeof lastPolledMachine !== 'undefined')) {
        machine = lastPolledMachine;
      } else if ((typeof machine === 'undefined') && (typeof lastPolledMachine === 'undefined')) {
        reject("no target machine");
      } else {
        $http.get('/api/machine/' + machine + '/' + command).then(function (response) {
          resolve(response.status);
        }).catch(function (err) {
          reject(err);
        });
      };
    })
  };

  return factory;
});

function valuesInRange(rangeA, rangeB) {
  let start = rangeA;
  let stop = rangeB;
  if (rangeA > rangeB) {
    start = rangeB;
    stop = rangeA;
  };
  let a = [start]
  let b = start;
  while (b < stop) {
    a.push(b += 1);
  }
  return a;
};

function ResumeController($scope, $mdDialog, time, title, theme) {
  $scope.time = time;
  $scope.title = title;
  $scope.theme = theme;
  $scope.hide = function () {
    $mdDialog.hide();
  };

  $scope.cancel = function () {
    $mdDialog.cancel();
  };

  $scope.answer = function (answer) {
    $mdDialog.hide(answer);
  };
};

document.oncontextmenu = function () {
  return false;
};

app.controller('viewController', function viewController($rootScope, $animate, $scope, $localStorage, $location, $http, $window, $timeout, elasticsearchFactory) {

  elasticsearchFactory.getAggs().then(function (result) {
    $scope.aggs = result;
  })

  $scope.toggleView = function () {
    if ($location.$$path === '/nodegraph') {
      $location.path('/');
    } else {
      $location.path('/nodegraph');
    }
  };

  $scope.$storage = $localStorage;

  if (!$localStorage.sortOptions) {
    $localStorage.sortOptions = { "title.keyword": { "order": "asc" } };
    $localStorage.selection = {
      topItem: 0,
      selectedItem: 0,
      multiselect: []
    };
  };

  $localStorage.sortColumn = Object.keys($localStorage.sortOptions)[0].replace('.keyword', '');
  $localStorage.sortOrder = $localStorage.sortOptions[Object.keys($localStorage.sortOptions)[0]].order;

  if ($localStorage.selection) {
    if ($localStorage.selection.selectedRangeEnd) {
      delete $localStorage.selection.selectedRangeEnd;
    }
  };

  if (!$localStorage.panelVisibility) {
    $localStorage.panelVisibility = {};
  };
  ['bbfc', 'mpaa', 'framegrabs', 'subtitles', 'discmetadata', 'moviemetadata', 'remote', 'shots'].forEach(function (panel) {
    if (!$localStorage.panelVisibility[panel]) {
      $localStorage.panelVisibility[panel] = false;
    };
  });

  //console.log(navigator.userAgent);

  $scope.panelstate = function (panel, visible) {
    console.log(panel, visible);
    $localStorage.panelVisibility[panel] = visible;
    if (visible === true) {
      $rootScope.$broadcast("refresh-panel", { id: panel, visible: visible });
    };
    if ($scope.videocat) {
      getItemDetails($scope.videocat.hits.hits[$localStorage.selection.selectedItem]);
    };
  };
  $http.get('/api/stats').then(function (response) {
    $scope.stats = response.data;
  }).catch(function (err) {
    console.log(err);
  })

})
