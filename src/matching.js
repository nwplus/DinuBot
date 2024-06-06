const updateDynamicArray = (dynamicArray) => {
	const lastDynamicArrayMember = dynamicArray[dynamicArray.length - 1];
	const dynamicArrayCopy = dynamicArray.slice();
	for (let i = 0; i < dynamicArray.length; i++) {
		if (i + 1 < dynamicArray.length) {
			dynamicArray[i + 1] = dynamicArrayCopy[i];
		}
	}
	dynamicArray[0] = lastDynamicArrayMember;
	return dynamicArray;
};

const createMatchings = (staticArray, dynamicArray, dontPairData) => {
	// dontPairData:
	// {ID: [string1, string2],
	//  ID2: [string1, string2],}

	const matchings = [];
	const maxAttempts = 100; // to avoid infinite loops
	let attempts = 0;

	const isValidPair = (item1, item2) => {
		return !(
			dontPairData[item1]?.includes(item2) ||
			dontPairData[item2]?.includes(item1)
		);
	};

	const shuffleArray = (array) => {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	};

	while (attempts < maxAttempts) {
		matchings = []; // clear matchings
		let valid = true;
		const shuffledDynamicArray = shuffleArray([dynamicArray]);

		// assumes dynamic array length is = staticArray or 1 longer
		// Match users based on their array position (note: staticArray will never > dynamicArray)
		for (let i = 0; i < staticArray.length; i++) {
			if (isValidPair(staticArray[i], shuffledDynamicArray[i])) {
				matchings.push([staticArray[i], shuffledDynamicArray[i]]);
			} else {
				valid = false;
				break;
			}
		}

		if (valid) {
			// if dynamicArray length is > staticArray (Should only be different by 1)
			if (dynamicArray.length > staticArray.length) {
				const leftOutMember = dynamicArray[dynamicArray.length - 1];
				// add that leftOutMember to a random group
				const randomPairIndex = Math.floor(
					Math.random() * (matchings.length - 1),
				);
				matchings[randomPairIndex].push(leftOutMember);
			}

			// Move dynamic array forward
			const newDynamicArray = updateDynamicArray(shuffledDynamicArray);
			return [matchings, newDynamicArray];
		}

		attempts++;
	}

	throw new Error("Unable to find a valid matching after maximum attempts");
};

module.exports = { createMatchings };
