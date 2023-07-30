// const getUserMatchings = (userIds) => {
// 	const getRandomIndex = (max) => Math.floor(Math.random() * max);

// 	let matchings = [];

// 	// If the number of user IDs is odd, form a group of 3 first
// 	if (userIds.length % 2 !== 0) {
// 		let group = [];
// 		for (let i = 0; i < 3; i++) {
// 			let randomIndex = getRandomIndex(userIds.length);
// 			group.push(userIds[randomIndex]);
// 			userIds.splice(randomIndex, 1); // Remove the selected user
// 		}
// 		matchings.push(group);
// 	}

// 	// Form pairs with the remaining users
// 	while (userIds.length > 0) {
// 		let pair = [];
// 		for (let i = 0; i < 2; i++) {
// 			let randomIndex = getRandomIndex(userIds.length);
// 			pair.push(userIds[randomIndex]);
// 			userIds.splice(randomIndex, 1); // Remove the selected user
// 		}
// 		matchings.push(pair);
// 	}
// 	return matchings;
// };

// module.exports = { getUserMatchings };

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

const createMatchings = (staticArray, dynamicArray) => {
	const matchings = [];
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