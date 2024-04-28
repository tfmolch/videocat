angular.module('list', [
  'ngRoute'
]).controller("listController", function ($scope, $rootScope, $localStorage, $q, $http, $mdDialog, $document, elasticsearchFactory, machineFactory, $mdMenu, $window, activitySocketFactory, detailsFactory, $compile, $timeout, $mdToast, $routeParams, $location) {
  var keyboardTriggers = false;
  $scope.$storage = $localStorage;

  function isMultiSelect() {
    if ($localStorage.selection.multiselect.length) {
      return true
    };
    return false;
  };

  machineFactory.getMachineList().then(function (result) {
    $scope.machines = result;
  });

  $scope.framegrabNav = function (direction) {
    $rootScope.$broadcast("framegrabs-nav", direction);
  };

  $scope.getTheme = function () {
    return $rootScope.getTheme();
  };

  var searchDialogShowing = false;
  var isSearchResultView = false;
  $scope.search = function () {
    if (searchDialogShowing === false) {
      searchDialogShowing = true;
      unbindKeyboardTriggers();
      var confirm = $mdDialog.prompt()
        .title('Search')
        .ariaLabel('Search Query')
        .initialValue('')
        .required(true)
        .theme($scope.getTheme())
        .ok('Search')
        .cancel('Cancel');

      $mdDialog.show(confirm).then(function (result) {
        bindKeyboardTriggers();
        console.log(result);

        function doSearch() {
          searchDialogShowing = false;
          var exactMatch = $scope.videocat.hits.hits.findIndex(function (x) {
            if (x._source.title.toLowerCase().trim() === result.toLowerCase().trim()) {
              return true;
            }
          });
          if (exactMatch > -1) {
            $scope.selectItem(exactMatch).then(function () {
              console.log("exactMatch: " + exactMatch);
              //$localStorage.selection.topItem = ($localStorage.selection.selectedItem - 10);
            });
          } else {
            $scope.fetchList(result).then(function () {
              isSearchResultView = true;
            });
          };
        }

        if (isSearchResultView === true) {
          $scope.resetFilter().then(function () {
            isSearchResultView = false;
            doSearch();
          })
        } else {
          doSearch();
        };

      }, function () {
        console.log('You cancelled the dialog.');
        bindKeyboardTriggers();
        searchDialogShowing = false;

      });
    }

  };

  $scope.dedupeMode = false;
  $scope.dupeArray = [];
  var catalogueBackup;

  $scope.toggleDupes = function () {
    if ($scope.dedupeMode === false) {
      console.log("dedupe mode ON");
      $scope.videocat.hits.hits.forEach(function (item) {
        var titleIndexes = $scope.videocat.hits.hits.map((x, i) => x._source.title === item._source.title ? i : -1).filter(index => index !== -1);
        if (titleIndexes.length > 1) {
          if ($scope.dupeArray.indexOf(item._source.title) === -1) {
            console.log(item._source.title + " has dupes", titleIndexes);
            $scope.dupeArray.push(item._source.title);
          };
        };
      });
      $scope.sortBy('title', 'asc');
      $scope.dedupeMode = true;
      var dupes = $scope.videocat.hits.hits.filter(function (item) {
        if ($scope.dupeArray.indexOf(item._source.title) > -1) {
          return true;
        };
        return false;
      });
      catalogueBackup = JSON.parse(JSON.stringify($scope.videocat.hits.hits));
      $timeout(function () {
        $scope.videocat.hits.hits = dupes;
      });
      console.log(dupes.length + " duplicates in library");

    } else {
      console.log("dedupe mode OFF");
      $scope.dupeArray = [];
      $scope.dedupeMode = false;
      $timeout(function () {
        $scope.videocat.hits.hits = catalogueBackup;
        catalogueBackup = null;
      });
      //$scope.fetchList(null,false);
    };
  };

  $scope.openMenu = function ($mdMenu, ev) {
    originatorEv = ev;
    $mdMenu.open(ev);
  };

  $rootScope.$on("extract-subtitles", function (ev, socketmsg) {
    if (socketmsg.data.path === $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.path) {
      console.log("refresh localsubtitles");
      $http.post('https://subs.abg.thomasfelder.com/localsubtitles', { title: $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.title, path: $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.path }).then(function (response) {
        $scope.details.localsubtitles = response.data;
      }).catch(function (error) {
        console.log(error);
      });
    }
  });
  $rootScope.$on("refresh-snapshot", function (ev, socketmsg) {
    if (socketmsg === $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.title) {
      $http.post('/api/details/framegrabs', $scope.videocat.hits.hits[$localStorage.selection.selectedItem]).then(function (response) {
        $scope.details.framegrabs = response.data;
      }).catch(function (error) {
        console.log(error);
      });
    }
  });

  $rootScope.$on("catalogue-updated", function (ev, newDiskObject) {
    console.log("catalogue update socket event received")
    elasticsearchFactory.currentCatalogueData().then(function (catalogueData) {
      $scope.videocat = catalogueData;
      //$scope.sortBy(Object.keys($localStorage.sortOptions)[0], $localStorage.sortOrder).then(function () {
        if ((newDiskObject) && ($localStorage.sortColumn === 'added')) {
          var newTitleIndex = $scope.videocat.hits.hits.findIndex(x => x._source.title === newDiskObject._source.title);
          if (newTitleIndex > -1) {
            $scope.selectItem(newTitleIndex);
          };
        }
      //})
    });

  });

  $scope.extractSubtitles = function (trackid) {
    if ($scope.modifiers.shift === true) {
      var legacy = false;
    } else {
      var legacy = true;
    };
    if ($scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.mediatype === 'DVD') {
      var title = $scope.details.discmetadata.main_title_track.ix[0]
    } else {
      var title = $scope.details.discmetadata.bluray['main playlist'];
    }

    var data = {
      path: $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.path,
      title: title,
      track: trackid,
      legacy: legacy,
      mediatype: $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.mediatype
    };

    $http.post('https://subs.abg.thomasfelder.com/subs/extract', data).then(function (response) {
      console.log(response.data);
    }).catch(function (err) {
      console.log(error);
    })
  };

  $scope.showSubtitleTrackList = function () {
    if (!$scope.details.discmetadata) {
      $scope.subtitleTracks = {
        loading: true
      };
      detailsFactory.getDiscMetadata().then(function (metadata) {
        $scope.details.discmetadata = metadata;
        $scope.subtitleTracks = {
          loading: false,
          visible: true
        };
      }).catch(function (error) {
        console.log(error);
      });
    } else {
      $scope.subtitleTracks = {
        loading: false,
        visible: true
      };
    }
  }

  function elementInView(index, element) {
    if ((index) && (element)) {
      if (element[0]) {
        if (index >= $localStorage.selection.topItem) {
          var scrollContainerHeight = element[0].parentElement.clientHeight;
          var elementHeight = element[0].offsetHeight;
          var numItems = Math.floor(scrollContainerHeight / elementHeight);
          var itemRelativePosition = (index - $localStorage.selection.topItem);
          console.log(itemRelativePosition, numItems);
          if (itemRelativePosition >= numItems) {
            $timeout(function () {
              $localStorage.selection.topItem = (index - (numItems - 1));
              $('.md-virtual-repeat-scroller').scrollTop(($localStorage.selection.topItem * 30));
            });
          }
        } else {
          $timeout(function () {
            $localStorage.selection.topItem = index;
            $('.md-virtual-repeat-scroller').scrollTop(($localStorage.selection.topItem * 30));
          });
        };
      } else {
        $timeout(function () {
          $localStorage.selection.topItem = index;
          $('.md-virtual-repeat-scroller').scrollTop(($localStorage.selection.topItem * 30));
        });
      }
    } else {
      $timeout(function () {
        $localStorage.selection.topItem = index;
        $('.md-virtual-repeat-scroller').scrollTop(($localStorage.selection.topItem * 30));
      });
    }
  };

  $scope.details = {};

  $scope.selectItem = function (index) {
    if ($scope.videocat.hits.hits[index]) {
      return $q(function (resolve, reject) {
        //console.log($scope.videocat.hits.hits[index]);

        if (($scope.modifiers.shift === false) && ($scope.modifiers.control === false) && ($scope.modifiers.meta === false)) {
          if ($scope.videocat.hits.hits[index]._id !== detailsFactory.itemId()) {
            detailsFactory.setItem($scope.videocat.hits.hits[index]).then(function () {
              $rootScope.$broadcast("select-item", isMultiSelect());
            })
          }
          $localStorage.selection.multiselect = [];
          if (index !== $localStorage.selection.selectedItem) {
            if ($scope.videocat.hits.hits[index]) {
              //$window.stop();
              $scope.details = {};
              delete $localStorage.selection.selectedRangeEnd;

              $localStorage.selection.selectedItem = index;
              var element = angular.element(document.querySelector('#catalogue-item-' + index));
              elementInView(index, element);
              //angular.element( document.querySelector( '#catalogue-item-'+index)).addClass('selected-row');

              if (!$scope.videocat.hits.hits[index]._source.rating) {
                $scope.videocat.hits.hits[index]._source.rating = 0;
              }
              console.log("Select item: " + index + "; top Item: " + $localStorage.selection.topItem);
              resolve();
            }
          } else {
            var element = angular.element(document.querySelector('#catalogue-item-' + index));
            elementInView(index, element);
            resolve();
          }
        } else if ($scope.modifiers.shift === true) {
          $localStorage.selection.selectedRangeEnd = index;
          console.log("Select range: " + $localStorage.selection.selectedItem + " to " + $localStorage.selection.selectedRangeEnd);
        } else if (($scope.modifiers.meta === true) || ($scope.modifiers.control === true)) {
          detailsFactory.setItem($scope.videocat.hits.hits[index]).then(function () {
            $rootScope.$broadcast("select-item", isMultiSelect());
          })
          if (!$localStorage.selection.multiselect) {
            $localStorage.selection.multiselect = [$scope.videocat.hits.hits[index]._id];
          } else {
            var existingIndex = $localStorage.selection.multiselect.indexOf($scope.videocat.hits.hits[index]._id);
            if (existingIndex === -1) {
              $localStorage.selection.multiselect.push($scope.videocat.hits.hits[index]._id);
            } else {
              //un-multiselect item
              $localStorage.selection.multiselect.splice(existingIndex, 1);
            };
          }
          console.log($localStorage.selection.multiselect);
        }
      });
    };

  };


  $scope.fetchList = function (query, reload, allfields, name) {
    return $q(function (resolve, reject) {
      // initial load
      if (!$scope.videocat) {
        reload = true;
      };

      console.log("fetchList triggered: " + query)
      var previouslySelectedTitle
      var searchQueryTarget

      elasticsearchFactory.search(query, reload, allfields, name).then(function (response) {
        if ($scope.videocat) {
          if ($scope.videocat.hits.hits[$localStorage.selection.selectedItem]) {
            previouslySelectedTitle = $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.title;
          }
        };

        $timeout(function () {
          console.log("received " + response.hits.hits.length + " items from elasticsearchFactory");
          $scope.videocat = response;

          console.log("$location.search().select:", $location.search().select)

          if ($location.search().select) {

            previouslySelectedTitle = decodeURIComponent($location.search().select)
            console.log("should re-select " + previouslySelectedTitle);

          } else if ((($localStorage.selection.selectedItem) && ($scope.videocat.hits.hits.length >= $localStorage.selection.selectedItem)) && (!$location.search().select)) {
            var previouslySelectedTitleItem = $scope.videocat.hits.hits[$localStorage.selection.selectedItem]
            if (previouslySelectedTitleItem) {
              previouslySelectedTitle = previouslySelectedTitleItem._source.title;
              console.log("should re-select " + previouslySelectedTitle);
            }
          };

          if ((previouslySelectedTitle) && (!searchQueryTarget)) {
            var newSelectionIndex = $scope.videocat.hits.hits.findIndex(function (x) {
              if (x._source.title === previouslySelectedTitle) {
                return true;
              }
            });
            if (newSelectionIndex > -1) {
              console.log("new index for " + previouslySelectedTitle + " is " + newSelectionIndex);

              $scope.selectItem(newSelectionIndex).then(function () {
                console.log("newSelectionIndex: " + newSelectionIndex);

                //$localStorage.selection.topItem = ($localStorage.selection.selectedItem - 10);
              });
            } else {
              console.log("could not find " + previouslySelectedTitle + " in catalogue response");

              $scope.selectItem(0);
            };
          } else {
            $scope.selectItem(0);
          };
          console.log("fetchList resolve")

          resolve();

        });

      });
    })
  };

  $scope.fetchList();

  var modifierTrigger = function (event) {
    if (!event.shiftKey) {
      console.log("shift up");
      $scope.modifiers.shift = false;
    };
    if (!event.ctrlKey) {
      console.log("control up");
      $scope.modifiers.control = false;
    };
    if (!event.metaKey) {
      console.log("meta up");
      $scope.modifiers.meta = false;
    };
    switch (event.keyCode) {
      case 16:
        if ((event.shiftKey === true) && ($scope.modifiers.shift === false)) {
          console.log("shift down");
          $scope.modifiers.shift = true;
        } else if ((event.shiftKey === false) && ($scope.modifiers.shift === true)) {
          console.log("shift up");
          $scope.modifiers.shift = false;
        }
        break;
      case 93:
        if ((event.metaKey === true) && ($scope.modifiers.meta === false)) {
          console.log("meta down");
          $scope.modifiers.meta = true;
        } else if ((event.metaKey === false) && ($scope.modifiers.meta === true)) {
          console.log("meta up");
          $scope.modifiers.meta = false;
        }
        break;
      case 17:
        if ((event.ctrlKey === true) && ($scope.modifiers.control === false)) {
          console.log("control down");
          $scope.modifiers.control = true;
        } else if ((event.ctrlKey === false) && ($scope.modifiers.control === true)) {
          console.log("control up");
          $scope.modifiers.control = false;
        }
        break;
      default:
        return;
    }
  };

  var keyboardTrigger = function (event) {

    //console.log(event);
    if (event.keyCode === 46) {
      // delete
      $scope.deleteTitles($scope.videocat.hits.hits[$localStorage.selection.selectedItem], $localStorage.selection.selectedItem);
      //$localStorage.selection.topItem = 0;
      $scope.$apply();
    };
    if (event.keyCode === 35) {
      // end bottom and select last
      $scope.selectItem($scope.videocat.hits.total.value - 1);
      //$localStorage.selection.topItem = 0;
      $scope.$apply();
    };
    if (event.keyCode === 36) {
      // pos1 top and select 0
      $scope.selectItem(0);
      $localStorage.selection.topItem = 0;
      $scope.$apply();
    };
    if (event.keyCode === 27) {
      // escape, reset query
      //event.preventDefault();

      if ($scope.dedupeMode === true) {
        console.log("ESCAPE – dedupe mode is on, toggle off, refresh FALSE");
        $scope.toggleDupes();
      } else if (isSearchResultView === true) {
        console.log("ESCAPE – reset filter, refresh FALSE");
        $scope.resetFilter(true).then(function () {
          isSearchResultView = false;
        });
      } else {
        console.log("ESCAPE – reload catalogue, refresh TRUE");
        $scope.fetchList(null, true).then(function () {
          isSearchResultView = false;
        });
      };

    };
    if (event.keyCode === 70) {
      //event.preventDefault();
      $scope.search();
    };
    if (event.keyCode === 40) {
      event.preventDefault();
      //down
      if ($scope.modifiers.shift === true) {
        if ($localStorage.selection.selectedRangeEnd) {
          if (($localStorage.selection.selectedRangeEnd > ($localStorage.selection.selectedItem - 1)) || ($localStorage.selection.selectedRangeEnd < ($localStorage.selection.selectedItem - 1))) {
            $localStorage.selection.selectedRangeEnd += 1;
          } else if ($localStorage.selection.selectedRangeEnd === ($localStorage.selection.selectedItem + 1)) {
            delete $localStorage.selection.selectedRangeEnd;
          };
        } else {
          $localStorage.selection.selectedRangeEnd = ($localStorage.selection.selectedItem + 1);
        };
        $scope.$apply();
        //console.log($localStorage.selection);
      } else {
        if ($scope.videocat.hits.hits[$localStorage.selection.selectedItem]) {
          if (($localStorage.selection.selectedItem + 1) !== $scope.videocat.hits.total.value) {
            $scope.selectItem($localStorage.selection.selectedItem + 1);
            //$localStorage.selection.topItem = $localStorage.selection.selectedItem-3;
            $scope.$apply();
          }
        } else {
          $scope.selectItem(0);
          $scope.$apply();
        }
      }
    };
    if (event.keyCode === 38) {
      event.preventDefault();
      //up
      if ($scope.modifiers.shift === true) {
        if ($localStorage.selection.selectedRangeEnd) {
          if (($localStorage.selection.selectedRangeEnd > ($localStorage.selection.selectedItem + 1)) || ($localStorage.selection.selectedRangeEnd < ($localStorage.selection.selectedItem + 1))) {
            $localStorage.selection.selectedRangeEnd -= 1;

          } else if ($localStorage.selection.selectedRangeEnd === ($localStorage.selection.selectedItem + 1)) {
            delete $localStorage.selection.selectedRangeEnd;
          };
        } else {
          $localStorage.selection.selectedRangeEnd = ($localStorage.selection.selectedItem - 1);
        };
        $scope.$apply();
        console.log($localStorage.selection);
      } else {
        if ($scope.videocat.hits.hits[$localStorage.selection.selectedItem]) {
          if ($localStorage.selection.selectedItem > 0) {
            $scope.selectItem($localStorage.selection.selectedItem - 1);
            //$localStorage.selection.topItem = $localStorage.selection.selectedItem-3;
            $scope.$apply();
          }
        } else {
          $scope.selectItem(0);
          $scope.$apply();
        }
      }
    };
    if (event.keyCode === 39) {
      //event.preventDefault();

      //right
      $scope.framegrabNav('next');
      $scope.$apply();

    };
    if (event.keyCode === 37) {
      //event.preventDefault();

      //left
      $scope.framegrabNav('previous');
      $scope.$apply();

    };
    if (event.keyCode === 13) {
      //event.preventDefault();
      //return
      $scope.playTitle();

    };
    if ((event.keyCode === 82) && (event.metaKey === true)) {
      //reload
      console.log("Window Refresh");
      location.reload();
    };
    if (event.keyCode === 32) {
      // space play-pause
      event.preventDefault();
      machineFactory.getSelectedMachine().then(function (machine) {
        machineFactory.sendCommand(machine.name, 'pl_pause').then(function (responsecode) {
          console.log(machine.name + ": pl_pause");
        })
      })
    };
  };

  function bindKeyboardTriggers() {
    if (keyboardTriggers === false) {
      $scope.modifiers = {
        shift: false,
        meta: false,
        control: false
      }
      $document.bind('keydown', keyboardTrigger);
      $document.bind('keydown', modifierTrigger);
      $document.bind('keyup', modifierTrigger);
      keyboardTriggers = true;
      console.log("bindKeyboardTriggers")
    };
  };

  function unbindKeyboardTriggers() {
    return $q(function (resolve, reject) {
      if (keyboardTriggers === true) {
        $document.unbind('keydown', keyboardTrigger);
        $document.unbind('keydown', modifierTrigger);
        $document.unbind('keyup', modifierTrigger);
        keyboardTriggers = false;
        console.log("unbindKeyboardTriggers")
        resolve();
      } else {
        resolve();
      }
    });
  };

  bindKeyboardTriggers();

  $scope.modifiers = {
    shift: false,
    meta: false,
    control: false
  }

  $scope.contextMenu = {
    visible: false,
    posX: 0,
    posY: 0
  }
  $scope.autofill = {
    visible: false
  };

  $scope.goAwayContextMenu = function (rebindKeyboardTriggers) {
    $scope.autofill = {
      visible: false
    };
    $scope.contextMenu.visible = false;
    if (rebindKeyboardTriggers !== false) {
      bindKeyboardTriggers();
    };
  }

  $scope.setContextMenuPosition = function (event) {
    if ((Math.abs($scope.contextMenu.posY - event.clientY) > 430) || (Math.abs($scope.contextMenu.posX - event.clientX) > 350)) {
      //          if (((event.clientX+500) <= $window.innerWidth)&&((event.clientY+300) <= $window.innerHeight)){
      $scope.contextMenu.posY = event.clientY;
      $scope.contextMenu.posX = event.clientX;
      //          }
    }
  };

  $scope.contextMenu = function (index, event) {
    $scope.contextMenu.posY = event.clientY;
    $scope.contextMenu.posX = event.clientX;
    //unbindKeyboardTriggers();
    $scope.contextMenu.visible = true;
  };

  $scope.handleClick = function (index, event) {

    //console.log(event)
    if (!event.shiftKey) {
      console.log("shift up");
      $scope.modifiers.shift = false;
    } else if (event.shiftKey) {
      console.log("shift down");
      $scope.modifiers.shift = true;
    };

    if (!event.ctrlKey) {
      console.log("control up");
      $scope.modifiers.control = false;
    } else if (event.ctrlKey) {
      console.log("meta down");
      $scope.modifiers.control = true;
    };

    if (!event.metaKey) {
      console.log("meta up");
      $scope.modifiers.meta = false;
    } else if (event.metaKey) {
      console.log("meta down");
      $scope.modifiers.meta = true;
    };

    switch (event.which) {
      case 1:
        $scope.selectItem(index); // this is left click
        break;
      case 2:
        // in case you need some middle click things
        break;
      case 3:
        if (!$localStorage.selection.selectedRangeEnd) {
          $scope.selectItem(index);
        };
        $scope.contextMenu(index, event); // this is right click
        break;
      default:
        //alert("you have a strange mouse!");
        break;
    };
  };

  $scope.isInSelectionRange = function (index) {
    if ($localStorage.selection.selectedRangeEnd) {
      var rangeA = $localStorage.selection.selectedItem;
      var rangeB = $localStorage.selection.selectedRangeEnd;
      if (rangeA > rangeB) {
        // selection up
        if ((index < rangeA) && (index >= rangeB)) {
          return true;
        }
        return false;
      } else {
        // selection down
        if ((index <= rangeB) && (index >= rangeA)) {
          return true;
        }
        return false;
      }
    }
    return false;
  };

  $scope.editTitle = function () {
    var titledata = $scope.videocat.hits.hits[$localStorage.selection.selectedItem];
    var index = $localStorage.selection.selectedItem;
    unbindKeyboardTriggers();

    $scope.entry = titledata;
    $mdDialog.show({
      controller: EditEntryController,
      templateUrl: 'editentry.html',
      scope: $scope, // use parent scope in template
      preserveScope: true, // do not forget this if use parent scope
      parent: angular.element(document.body),
      clickOutsideToClose: false,
      fullscreen: false // Only for -xs, -sm breakpoints.
    })
      .then(function (answer) {
        bindKeyboardTriggers();
        if (answer == "cancel") {
          console.log(answer);

        };
        if (answer == "update") {
          $http.post('/api/update', $scope.entry).then(function (response) {
            console.log(response.data);
            if (!response.data.error) {
              $scope.videocat.hits.hits[index]._id = response.data._id;
              $scope.videocat.hits.hits[index]._source = response.data._source;
              elasticsearchFactory.copyCatUpdate($scope.videocat.hits.hits[index])
            } else {
              $mdToast.show(
                $mdToast.simple().textContent(response.data.message).position("bottom left").hideDelay(3000)
              );
            };
          });
        };
      }, function () {
        console.log('You cancelled the dialog.');
        bindKeyboardTriggers();
      });
  };
  $scope.markPlayed = function () {
    if ($localStorage.selection.selectedRangeEnd) {
      var indexes = valuesInRange($localStorage.selection.selectedItem, $localStorage.selection.selectedRangeEnd);
      indexes.forEach(function (index) {
        markItemPlayed(index);
      })
    } else {
      var index = $localStorage.selection.selectedItem;
      markItemPlayed(index);
    };
    function markItemPlayed(index) {
      var item = $scope.videocat.hits.hits[index];
      $http.post('/api/played', item).then(function (response) {
        console.log(response.data);
        if ($scope.videocat.hits.hits[index]._source.playcount) {
          $scope.videocat.hits.hits[index]._source.playcount += 1;
          $scope.videocat.hits.hits[index]._source.lastplayed = moment().format('x');

        } else {
          $scope.videocat.hits.hits[index]._source.playcount = 1;
          $scope.videocat.hits.hits[index]._source.lastplayed = moment().format('x');

        }
      });
    };
  };
  $scope.markUnplayed = function () {
    if ($localStorage.selection.selectedRangeEnd) {
      var indexes = valuesInRange($localStorage.selection.selectedItem, $localStorage.selection.selectedRangeEnd);
      indexes.forEach(function (index) {
        markItemUnplayed(index);
      })
    } else {
      var index = $localStorage.selection.selectedItem;
      markItemUnplayed(index);
    }
    function markItemUnplayed(index) {
      var item = $scope.videocat.hits.hits[index];
      $http.post('/api/unplayed', item).then(function (response) {
        console.log(response.data);
        $scope.videocat.hits.hits[index]._source.playcount = 0;
        delete $scope.videocat.hits.hits[index]._source.lastplayed;
      });
    };
  };
  $scope.markLoanOut = function () {

    function markLoanOut(index, comment) {
      var item = $scope.videocat.hits.hits[index];
      var data = {
        id: item._id,
        status: true,
        comment: comment
      }
      $http.post('/api/loan', data).then(function (response) {
        console.log(response.data);
        if (response.data.result === "updated") {
          $scope.videocat.hits.hits[index]._source.loan = data;
        }
      });
    };
    unbindKeyboardTriggers().then(function () {
      var confirm = $mdDialog.prompt()
        .title('Loan')
        .ariaLabel('Loan Comment')
        .initialValue('')
        .required(true)
        .theme($scope.getTheme())
        .ok('Loan Out')
        .cancel('Cancel');

      $mdDialog.show(confirm).then(function (result) {
        if ($localStorage.selection.selectedRangeEnd) {
          var indexes = valuesInRange($localStorage.selection.selectedItem, $localStorage.selection.selectedRangeEnd);
          indexes.forEach(function (index) {
            markLoanOut(index, result);
          })
        } else {
          var index = $localStorage.selection.selectedItem;
          markLoanOut(index, result);
        };
        bindKeyboardTriggers();

      }, function () {
        console.log('You cancelled the dialog.');
        bindKeyboardTriggers();
      });
    });
  };

  $scope.markLoanIn = function () {
    if ($localStorage.selection.selectedRangeEnd) {
      var indexes = valuesInRange($localStorage.selection.selectedItem, $localStorage.selection.selectedRangeEnd);
      indexes.forEach(function (index) {
        markLoanIn(index);
      })
    } else {
      var index = $localStorage.selection.selectedItem;
      markLoanIn(index);
    };

    function markLoanIn(index) {
      var item = $scope.videocat.hits.hits[index];
      var data = {
        id: item._id,
        status: false
      }
      $http.post('/api/loan', data).then(function (response) {
        console.log(response.data);
        if (response.data.result === "updated") {
          delete $scope.videocat.hits.hits[index]._source.loan;
        }
      });
    };
  };

  $scope.markDamaged = function () {
    if ($localStorage.selection.selectedRangeEnd) {
      var indexes = valuesInRange($localStorage.selection.selectedItem, $localStorage.selection.selectedRangeEnd);
      indexes.forEach(function (index) {
        markDamaged(index);
      })
    } else {
      var index = $localStorage.selection.selectedItem;
      markDamaged(index);
    };
    function markDamaged(index) {
      var item = $scope.videocat.hits.hits[index];
      $http.post('/api/damage', { id: item._id, status: true }).then(function (response) {
        console.log(response.data)
        if (response.data.result === "updated") {
          $scope.videocat.hits.hits[index]._source.damaged = true;
        }
      });
    };
  };

  $scope.markFixed = function () {
    if ($localStorage.selection.selectedRangeEnd) {
      var indexes = valuesInRange($localStorage.selection.selectedItem, $localStorage.selection.selectedRangeEnd);
      indexes.forEach(function (index) {
        markFixed(index);
      })
    } else {
      var index = $localStorage.selection.selectedItem;
      markFixed(index);
    };
    function markFixed(index) {
      var item = $scope.videocat.hits.hits[index];
      $http.post('/api/damage', { id: item._id, status: false }).then(function (response) {
        console.log(response.data)

        if (response.data.result === "updated") {
          $scope.videocat.hits.hits[index]._source.damaged = false;
        }
      });
    }
  };

  $scope.autofillItemMetadata = function (autofillData) {
    console.log(autofillData);
    $http.post('/api/autofill/upsert', {
      title: $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.title,
      tmdbdata: autofillData,
      path: $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.path,
      esid: $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._id
    }).then(function (response) {
      console.log(response.data);
      Object.keys(response.data).forEach(function (key) {
        $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source[key] = response.data[key];
      });
      elasticsearchFactory.copyCatUpdate($scope.videocat.hits.hits[$localStorage.selection.selectedItem])
    }).catch(function (err) {
      console.log(err);
    })

  };

  $scope.showComment = function (commentText, itemIndex, event) {
    var element = angular.element(document.getElementById('comment-' + itemIndex))[0];
    if (!element) {
      var html = '<div class="inline-comment" style="left:' + event.clientX + 'px;top:' + event.clientY + 'px;position:fixed;" id="comment-' + itemIndex + '" layout="column" layout-align="center stretch">\
                    <p class="inline-comment-text">'+ commentText + '</p></div>';
      var temp = $compile(html)($scope);
      var parent = angular.element(document.getElementById('catalogue-view-container'));
      parent.append(temp);
    }
  };
  $scope.hideComment = function (itemIndex) {
    var element = angular.element(document.getElementById('comment-' + itemIndex))[0];
    element.remove()
  };

  $scope.sortBy = function (columnName, order) {
    return $q(function (resolve, reject) {

      if ($scope.dedupeMode === true) {
        $scope.toggleDupes();
      };
      $localStorage.sortColumn = columnName;
      if (order) {
        $localStorage.sortOrder = order;
      };
      if ($localStorage.sortColumn == Object.keys($localStorage.sortOptions)[0].replace('.keyword', '')) {
        if (!order) {
          if ($localStorage.sortOptions[Object.keys($localStorage.sortOptions)[0]].order === 'asc') {
            $localStorage.sortOptions[Object.keys($localStorage.sortOptions)[0]].order = 'desc';
            $localStorage.sortOrder = 'desc';
          } else {
            $localStorage.sortOptions[Object.keys($localStorage.sortOptions)[0]].order = 'asc';
            $localStorage.sortOrder = 'asc';
          }
        };

      } else {
        $localStorage.sortOptions = {};
        if ((columnName !== 'year') && (columnName !== 'rating') && (columnName !== 'added') && (columnName !== 'number_of_shots') && (columnName !== 'asl_seconds') && (columnName !== 'writer') && (columnName !== 'editor')) {

          if (columnName.includes('.keyword')) {
            $localStorage.sortOptions[columnName + '.keyword'] = { "order": "asc" };
          } else {
            $localStorage.sortOptions[columnName + '.keyword'] = { "order": "asc" };
          };

          $localStorage.sortOrder = order || 'asc';
        } else {
          $localStorage.sortOptions[columnName] = { "order": "asc" };
          $localStorage.sortOrder = order || 'asc';
        }
      };
      $localStorage.sortColumn = columnName;
      var previousTop = $localStorage.selection.topItem;
      var previouslySelectedTitle = $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.title;
      var offset = $localStorage.selection.selectedItem - previousTop;
      console.log(Object.keys($localStorage.sortOptions)[0], $localStorage.sortOptions[Object.keys($localStorage.sortOptions)[0]].order);
      $scope.fetchList($scope.searchterm, false).then(function () {
        var newSelectionIndex = $scope.videocat.hits.hits.findIndex(function (x) {
          if (x._source.title === previouslySelectedTitle) {
            return true;
          }
        });
        $scope.selectItem(newSelectionIndex);
        $localStorage.selection.topItem = (newSelectionIndex - offset);
        resolve()

      });
    });
  };

  var playTriggered = false;

  function playTitle(resume, machine, titledata) {
    playTriggered = true;
    if (!titledata) {
      var titledata = $scope.videocat.hits.hits[$localStorage.selection.selectedItem];
    }
    var postObject = {
      title: titledata._source,
      id: titledata._id,
      resume: resume
    }
    if (machine) {
      postObject.machine = machine;
    };
    $http.post('/api/play', postObject).then(function (response) {
      console.log(response.data);
      playTriggered = false;
    });
  }
  $scope.previousClick;

  $scope.filterClick = function (name) {
    if ($scope.previousClick === name) {
      console.log("filter for name: " + name);
      $scope.fetchList(name, false, true, name);
    };
    $scope.previousClick = name;
  };

  $scope.resetFilter = function (clearQuery) {
    return $q(function (resolve, reject) {

      if (clearQuery === true) {
        delete $scope.searchterm;
      }

      console.log("reset filter, clear query: " + clearQuery + " query: " + $scope.searchterm);

      $scope.fetchList("", false).then(function () {
        isSearchResultView = false;
        resolve();
      }).catch(function (err) {
        console.log(err);
        reject(err);
      });
    })
  };

  $scope.playTitle = function (machine, titledata) {
    console.log("Play Title " + $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.title, "PlayTriggered: " + playTriggered);

    if (playTriggered === false) {
      if (!titledata) {
        var titledata = $scope.videocat.hits.hits[$localStorage.selection.selectedItem];
      }
      $http.get('/api/resume/' + titledata._id).then(function (response) {

        console.log(response.data);
        if (response.data.time) {
          $mdDialog.show({
            controller: ResumeController,
            templateUrl: '/partials/confirm.html',
            locals: {
              time: moment(response.data.time * 1000).utc().format('HH:mm:ss'),
              title: titledata._source.title,
              theme: $scope.getTheme()
            },
            clickOutsideToClose: true,
          }).then(function (answer) {
            if (answer === 'yes') {
              playTitle(response.data, machine, titledata);
            } else if (answer === 'no') {
              playTitle(false, machine, titledata);
            } else {
              console.log("Cancel");
            }
          }, function () {
            console.log("Cancel");
          });
        } else {
          playTitle(false, machine, titledata);
        }
      });
    } else {
      return;
    }
  };

  $scope.detectCuts = function () {
    unbindKeyboardTriggers();
    var esid = $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._id;
    var source = $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.path;
    var mediatype = $scope.videocat.hits.hits[$localStorage.selection.selectedItem]._source.mediatype;

    detailsFactory.getDiscMetadata().then(function (discmetadata) {
      if (mediatype === 'BD') {
        var maintitle = discmetadata.bluray['main playlist'];
      } else {
        var maintitle = discmetadata.main_title_track.ix[0];
      }

      if ($scope.modifiers.shift === true) {
        $scope.goAwayContextMenu(false);
        $scope.modifiers.shiftKey = false;
        var confirm = $mdDialog.prompt()
          .title('Threshold Value')
          .ariaLabel('Threshold Value')
          .initialValue('30.0')
          .required(true)
          .theme($scope.getTheme())
          .ok('Start')
          .cancel('Cancel');

        $mdDialog.show(confirm).then(function (result) {
          $http.post('https://cutdetect.abg.thomasfelder.com/cutdetect', { id: esid, source: source, mediatype: mediatype, threshold: result, maintitle: maintitle }).then(function (response) {
            console.log(response.data);
          });
          bindKeyboardTriggers();
        }, function () {
          console.log('You cancelled the dialog.');
          bindKeyboardTriggers();
        });

      } else {
        $scope.goAwayContextMenu();
        $http.post('https://cutdetect.abg.thomasfelder.com/cutdetect', { id: esid, source: source, mediatype: mediatype, threshold: 30.0, maintitle: maintitle }).then(function (response) {
          console.log(response.data);
        });
      }
    })


  }

  $scope.sendToHandbrake = function () {
    var item = $scope.videocat.hits.hits[$localStorage.selection.selectedItem];
    var index = $localStorage.selection.selectedItem;
    $http.post('/api/rip', item._source).then(function (response) {
      console.log(response.data);
    });
  };

  $scope.revealInFinder = function () {
    if ($localStorage.selection.selectedRangeEnd) {
      var indexes = valuesInRange($localStorage.selection.selectedItem, $localStorage.selection.selectedRangeEnd);
      indexes.forEach(function (index) {
        revealInFinder(index);
      })
    } else {
      var index = $localStorage.selection.selectedItem;
      revealInFinder(index);
    };
    function revealInFinder(index) {
      var item = $scope.videocat.hits.hits[index];
      $http.post('/api/reveal', item._source).then(function (response) {
        console.log(response.data);
      });
    }

  };

  $scope.showAutofill = function () {
    var index = $localStorage.selection.selectedItem;
    var titledata = $scope.videocat.hits.hits[index];
    $scope.autofill.visible = true;
    if ((!$scope.autofill.results) && ($scope.autofill.loading !== true)) {
      $scope.autofill.loading = true;
      $http.post('/api/autofill', titledata).then(function (response) {
        $scope.autofill.loading = false;
        console.log(response.data);
        if (Array.isArray(response.data)) {
          $scope.autofill.results = response.data;
        }
      });
    }
  };

  $scope.hideAutofill = function () {
    $scope.autofill.visible = false;
  };

  $scope.deleteTitles = function () {
    unbindKeyboardTriggers();


    if ($localStorage.selection.selectedRangeEnd) {

      var indexes = valuesInRange($localStorage.selection.selectedItem, $localStorage.selection.selectedRangeEnd);
      var todo = (indexes.length + 1);
      var done = 0;

      var confirm = $mdDialog.confirm()
        .title('Remove ' + todo + ' titles from Catalogue?')
        .htmlContent('<p>Files will remain on the disk.</p>')
        .ariaLabel('Remove')
        .theme($scope.getTheme())
        .ok('Remove')
        .cancel('Cancel');

      $mdDialog.show(confirm).then(function () {

        $scope.selectItem($localStorage.selection.selectedRangeEnd + 1);

        indexes.forEach(function (index) {

          var titledata = $scope.videocat.hits.hits[index];

          $http.post('/api/delete', titledata).then(function (response) {
            console.log(response.data);
            if (response.data.result === 'deleted') {
              $scope.videocat.hits.hits.splice(index, 1);
            }
            done += 1;
            if (todo === done) {
              console.log("deleted " + todo + " items from index")
              bindKeyboardTriggers();
            };

          });
        });

      }, function () {
        //cancelled
        bindKeyboardTriggers();

      });

    } else if ($localStorage.selection.multiselect.length) {

      var ids = JSON.parse(JSON.stringify($localStorage.selection.multiselect));
      var firstSelectedItemIndex = $localStorage.selection.selectedItem;
      var firstSelectedItemID = $scope.videocat.hits.hits[firstSelectedItemIndex]._id;
      ids.push(firstSelectedItemID);

      console.log($localStorage.selection);

      var todo = (ids.length);
      var done = 0;

      var confirm = $mdDialog.confirm()
        .title('Remove ' + todo + ' titles from Catalogue?')
        .htmlContent('<p>Files will remain on the disk.</p>')
        .ariaLabel('Remove')
        .theme($scope.getTheme())
        .ok('Remove')
        .cancel('Cancel');

      $mdDialog.show(confirm).then(function () {
        ids.forEach(function (id) {

          var index = $scope.videocat.hits.hits.findIndex(x => x._id === id);
          var titledata = $scope.videocat.hits.hits[index];

          $http.post('/api/delete', titledata).then(function (response) {
            console.log(response.data);
            if (response.data.result === 'deleted') {
              var index = $scope.videocat.hits.hits.findIndex(x => x._id === id);
              $scope.videocat.hits.hits.splice(index, 1);
            }
            done += 1;
            if (todo === done) {
              console.log("deleted " + todo + " items from index")
              bindKeyboardTriggers();
            };

          });

        });

      }, function () {
        //cancelled
        bindKeyboardTriggers();

      });

    } else {

      var index = $localStorage.selection.selectedItem;
      var titledata = $scope.videocat.hits.hits[index];
      var confirm = $mdDialog.confirm()
        .title('Remove ' + titledata._source.title + ' from Catalogue?')
        .htmlContent('<p class="prompt-path">' + titledata._source.path + '</p><p>will remain on the disk.</p>')
        .ariaLabel('Remove')
        .theme($scope.getTheme())
        .ok('Remove')
        .cancel('Cancel');

      $mdDialog.show(confirm).then(function () {
        $http.post('/api/delete', titledata).then(function (response) {
          console.log(response.data);
          if (response.data.result === 'deleted') {
            $scope.videocat.hits.hits.splice(index, 1);
          }
          bindKeyboardTriggers();

        });
      }, function () {
        //cancelled
        bindKeyboardTriggers();

      });
    };

  };

});
