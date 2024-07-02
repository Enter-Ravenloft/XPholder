function getActiveCharacterNumber(serverConfig, userRoles) {
  /*
      Parameters
      ----------
      serverConfig : object
      {
          levelUpMessage: 'string',
          levelUpChannelId: '0',
          moderationRoleId: '0',
          approveLevel: '10',
          approveMessage: 'string',
          roleBonus: 'highest',
          xpPerPostFormula: 'exponential',
          xpPerPostDivisor: '100',
          characterCount: '10',
          tier4RoleId: '0',
          tier3RoleId: '0',
          tier2RoleId: '0',
          tier1RoleId: '0',
          xpFreezeRoleId: '0',
          character1RoleId: '0',
          character2RoleId: '0',
          character3RoleId: '0',
          character4RoleId: '0',
          character5RoleId: '0',
          character6RoleId: '0',
          character7RoleId: '0',
          character8RoleId: '0',
          character9RoleId: '0',
          character10RoleId: '0'
      }
  
      userRoles : list of strings
      [
          "0",
          ...
      ]
  
      Returns
      -------
      activeCharacterIndex : number
      deafult - 1
      */
  for (
    let characterId = 1;
    characterId <= serverConfig["characterCount"];
    characterId++
  ) {
    if (userRoles.includes(serverConfig[`character${characterId}RoleId`])) {
      return characterId;
    }
  }

  return 1;
}

function getLevelInfo(levelObj, xp) {
  /*
      Parameters
      ----------
      levelObj : object
      {
          "1" : 300, ( xp needed to level up )
          "2" : 600
      }
  
      xp : number
  
      Returns
      -------
      object : 
      {
          "level" : "stringLevel",
          "levelXp" : 0,
          "xpToNext" : 0
      }
      */
  for (const [lvl, xpToNext] of Object.entries(levelObj)) {
    // subtract the lower level xp
    xp -= xpToNext;
    // if the xp went into the negatives, than that means, this is the level the player is on
    if (xp < 0) {
      // adding back the xp and returning the object
      xp += xpToNext;
      return { level: lvl, levelXp: xp, xpToNext: xpToNext };
    }
  }
  // if all the levels were itterated, and the player still has left over xp. Than they are max xp
  return { level: "20", levelXp: xp, xpToNext: xp };
}

function getRoleMultiplier(
  roleBonus,
  collectionOfGuildRoles,
  listOfPlayerRoles
) {
  /*
      Parameters
      ----------
      roleBonus : string
          "highest"
          "sum"
      
      collectionOfGuildRoles : object 
      {
          "roleId"  : 1, ( role bonus )
          "roleId2" : 2,
      }
  
      listOfPlayerRoles : list of strings
      [
          "roleId",
          "roleId2"
      ]
  
      Returns
      -------
      roleMultiplier : number
      */
  let roleMultiplier = 1;
  switch (roleBonus) {
    case "highest":
      for (const roleId of listOfPlayerRoles) {
        // if the players role is not in the object of role bonus, skip
        if (!(roleId in collectionOfGuildRoles)) {
          continue;
        }
        // if the player does have a role that is in the collection, and the role is greater than the current role, set the current role to that
        if (collectionOfGuildRoles[roleId] > roleMultiplier) {
          roleMultiplier = collectionOfGuildRoles[roleId];
        }
        // if the player has the xp freeze role, or any other role with 0 xp bonus, to set the role and return
        else if (collectionOfGuildRoles[roleId] == 0) {
          roleMultiplier = 0;
          break;
        }
      }
      break;
    case "sum":
      for (const roleId of listOfPlayerRoles) {
        // if the players role is not in the object of role bonus, skip
        if (!(roleId in collectionOfGuildRoles)) {
          continue;
        }
        // if the player has the xp freeze role, or any other role with 0 xp bonus, to set the role and return
        if (collectionOfGuildRoles[roleId] == 0) {
          roleMultiplier = 0;
          break;
        }
        // append the role to the roles
        roleMultiplier += collectionOfGuildRoles[roleId];
      }
      break;
  }
  return roleMultiplier;
}

function getTier(level) {
  /*
      Parameters
      ----------
      level : number
  
      Returns
      -------
      object :
      {
          "tier"     : 0, (current tier)
          "nextTier" : 1
      }
      */
  // WotC rules for which levels are in which tier
  if (level <= 4) {
    return { tier: 1, nextTier: 2 };
  } else if (level <= 10) {
    return { tier: 2, nextTier: 3 };
  } else if (level <= 16) {
    return { tier: 3, nextTier: 4 };
  }
  return { tier: 4, nextTier: 4 };
}

function getXp(
  wordCount,
  roleBonus,
  channelXpPerPost,
  xpPerPostDivisor,
  xpPerPostFormula
) {
  switch (xpPerPostFormula) {
    case "exponential":
      return (
        (channelXpPerPost + wordCount / xpPerPostDivisor) *
        (1 + wordCount / xpPerPostDivisor) *
        roleBonus
      );
    case "flat":
      return channelXpPerPost * roleBonus;
    case "linear":
      return (channelXpPerPost + wordCount / xpPerPostDivisor) * roleBonus;
  }
  return 0;
}

module.exports = {
  getActiveCharacterNumber,
  getLevelInfo,
  getRoleMultiplier,
  getTier,
  getXp,
};
