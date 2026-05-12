function formatParticipantName(participant) {
  if (participant.removal_reason === "death") {
    return `${participant.character_name} 💀 (Death)`;
  }
  return participant.character_name;
}

module.exports = { formatParticipantName };
