function mergeListOfObjects(listOfObjects) {
  let myObject = {};
  for (const listObject of listOfObjects) {
    for (const [myKey, myValue] of Object.entries(listObject)) {
      myObject[myKey] = myValue;
    }
  }
  return myObject;
}
function chunkArray(myArray, chunkSize) {
  let chukedArray = [];
  let index = 0;
  for (; index + chunkSize <= myArray.length; index += chunkSize) {
    chukedArray.push(myArray.slice(index, index + chunkSize));
  }
  if (myArray.length % chunkSize) {
    chukedArray.push(myArray.slice(index, myArray.length));
  }
  return chukedArray;
}
function splitObjectToList(myObject) {
  let myArray = [];
  for (const [myKey, myValue] of Object.entries(myObject)) {
    let subObject = {};
    subObject[myKey] = myValue;
    myArray.push(subObject);
  }
  return myArray;
}

function listOfObjsToObj(listOfObjs, key, value) {
  /*
      Parameters
      ----------
      listOfObjs : list of objects
      [
          {key : "key" , value : "value"},
          {key : "key2", value : "value2"},
          {key : "key3", value : "value3"},
      ]
  
      key   : string
      value : string
  
      Returns
      -------
      masterObj : object
      {
          "key"  : "value",
          "key2" : "value2",
          "key3" : "value3"
      }
      */
  let masterObj = {};
  for (const myObj of listOfObjs) {
    masterObj[myObj[key]] = myObj[value];
  }
  return masterObj;
}

module.exports = {
  mergeListOfObjects,
  chunkArray,
  splitObjectToList,
  listOfObjsToObj,
};
