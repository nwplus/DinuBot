const updateDynamicArray = (dynamicArray) => {
	const lastDynamicArrayMember = dynamicArray[dynamicArray.length - 1];
	const dynamicArrayCopy = dynamicArray.slice();
	for (let i = 0; i < dynamicArray.length; i++) {
		if (i+1 < dynamicArray.length) {
			dynamicArray[i+1] = dynamicArrayCopy[i];
		}
	}
	dynamicArray[0] = lastDynamicArrayMember;
	return dynamicArray;
}

const createMatchings = (staticArray, dynamicArray, dontPairData) => {
	const matchings = [];
	// dontPairData is a hashmap {key: ID, value: [dontPairID1, dontPairID2]}
	// check if dontPairData[staticArray[i] is in]
	// assumes dynamic array length is = staticArray or 1 longer
	// Match users based on their array position (note: staticArray will never > dynamicArray)
	for (let i=0; i < staticArray.length; i++) {
		matchings.push([staticArray[i], dynamicArray[i]]); 
	}
	// if dynamicArray length is > staticArray (Should only be different by 1)
	if (dynamicArray.length > staticArray.length) {
		const leftOutMember = dynamicArray[dynamicArray.length - 1];
		// add that leftOutMember to a random group
		const randomPairIndex = Math.floor(Math.random() * (matchings.length - 1));
		matchings[randomPairIndex].push(leftOutMember);
	}

	// move dynamic array forward
	newDynamicArray = updateDynamicArray(dynamicArray);
	
	return [matchings, newDynamicArray];
}

module.exports = { createMatchings };