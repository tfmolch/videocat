angular.module('nodegraph', [
  'ngRoute'
]).controller('nodegraphController', function collectionsController($scope, $localStorage, elasticsearchFactory, detailsFactory, $http, $q) {
  console.log($localStorage);

  $scope.nodeTypes;

  elasticsearchFactory.currentCatalogueData().then(function(){
    detailsFactory.getItem().then(function(item){
      $scope.activenode = item._source.title;
      $http.get('/api/nodegraph/'+item._id+'/crew').then(function(response) {

          let data = response.data
          let nodeGroups = [...new Set(data.nodes.map(item => item.group))];

          console.log(data);

          $scope.nodeGraphData = response.data;
          $scope.nodeTypes = nodeGroups.sort();

      });
    });
  })

  $scope.$on("$destroy", function(){
    console.log('destroy nodegraphController')
  });

  $scope.movieNodeList;
  $scope.searchList = [];
  $scope.activenode;
  $scope.activeTypeFilter;
  $scope.searchText = '';


  $scope.flyToNode = function(id){
    $scope.activenode = id;
    detailsFactory.setItemByName(id);
  }

  $scope.filterNodes = function(type){

    if ($scope.activeTypeFilter===type){
      $scope.activeTypeFilter=null
    } else {
      $scope.activeTypeFilter=type
    };

    //detailsFactory.setItemByName(id);
  }

  $scope.querySearch = function(query) {
    var results = $scope.searchList.filter(function (node) {
          return node.id.toLowerCase().includes(query?.toLowerCase());
      });
      console.log(results);

    return results;
  }

  $scope.$watch('activenode', function(newVal,oldVal) {
    if(oldVal !== newVal){
      console.log($scope.activenode+" selected");
      $scope.searchText = $scope.activenode;
    };
  });

  $scope.$watch('nodeGraphData', function(newVal,oldVal) {
    if(oldVal !== newVal){
      var newMovieList = [];
      $scope.searchList = [];
      $scope.nodeGraphData.nodes.forEach(function(node){
        if (node.type === 'movie'){
          newMovieList.push({id:node.id,group:node.group,year:node.year})
        }
        $scope.searchList.push({id:node.id,group:node.group,year:node.year})
      })
      $scope.movieNodeList = newMovieList.sort(function(a, b){
          if(a.id.toLowerCase().replace('The ','') < b.id.toLowerCase().replace('The ','')) { return -1; }
          if(a.id.toLowerCase().replace('The ','') > b.id.toLowerCase().replace('The ','')) { return 1; }
          return 0;
      });

    }
  })
})
