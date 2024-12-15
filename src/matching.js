// Updated createMatchings function to form groups of 4
const createMatchings = (staticArray, dynamicArray, groupSize = 4) => {
	const allMembers = [...staticArray, ...dynamicArray];
	const shuffledMembers = shuffleArray(allMembers);
	const matchings = [];

	// Form groups of the specified size
	while (shuffledMembers.length >= groupSize) {
		matchings.push(shuffledMembers.splice(0, groupSize));
	}

	// Handle remaining members (if group size isn't divisible evenly)
	if (shuffledMembers.length > 0) {
		matchings.push(shuffledMembers);
	}

	// Return the matchings and updated dynamic array
	const updatedDynamicArray = shuffledMembers;
	return [matchings, updatedDynamicArray];
};

// Helper function to shuffle array
const shuffleArray = (array) => {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
};

module.exports = { createMatchings };