import AsciiTable from "ascii-table";

/** yoctoNear -> NEAR tokens*/
export const countNearTokens = (yoctoNear) => {
  const nearTokens = parseFloat(yoctoNear / 10e23).toFixed(5);
  return new Intl.NumberFormat().format(nearTokens) || "??";
};

export const countProductivity = (validatorState) => {
  const productivityInfo =
    (validatorState?.num_produced_blocks + validatorState?.num_produced_chunks + validatorState?.num_produced_endorsements) /
    (validatorState?.num_expected_blocks + validatorState?.num_expected_chunks + validatorState?.num_expected_endorsements);

  const productivity = productivityInfo
    ? parseFloat((productivityInfo * 10000) / 100).toFixed(5)
    : 0;

  return productivity;
};

/** make Ascii table about validator state statistics */
export const getChunksBlocksEndorsementsStat = (tableName = "", validatorState = {}) => {
  const prevProdTable = new AsciiTable(/* tableName */);
  prevProdTable
    .setHeading("", "Expected", "Produced" )
    .addRow(
      "Blocks",
      validatorState.num_expected_blocks,
      validatorState.num_produced_blocks
    )
    .addRow(
      "Chunks",
      validatorState.num_expected_chunks,
      validatorState.num_produced_chunks
    )
    .addRow(
      "Endorsements",
      validatorState.num_expected_endorsements,
      validatorState.num_produced_endorsements
    )

  return [
    `\n📊 ${tableName}: ${countProductivity(validatorState)}%`,
    "```",
    prevProdTable.toString(),
    "```",
  ].join("\n");
};

export const prepareSwitchingEpochInfo = (
  epochHeight,
  oldState,
  newState,
  kickoutStatus,
  poolId
) => {
  const epochTable = new AsciiTable(`Epoch №${epochHeight}`);
  const stakePercentChange = ((newState?.stake - oldState?.stake) / oldState?.stake) * 100;
  const stakeDifference = countNearTokens(newState?.stake - oldState?.stake);
  const percentIcon = stakePercentChange > 0 ? "🤑⬆️" : "🔻";

  epochTable
    .setHeading("", "Previous", "Current")
    .addRow(
      "current",
      !!oldState ? "validator" : "⨯",
      !!newState ? "validator" : "⨯"
    )
    .addRow(
      "next",
      !!oldState ? "validator" : "⨯",
      !!newState ? "validator" : "⨯"
    )
    .addRow(
      "stake",
      countNearTokens(oldState?.stake) + " N",
      countNearTokens(newState?.stake) + " N"
    );

  const epochTableStr = ["```", epochTable.toString(), "```"].join("\n");

  // Producticity table if node was a validator in prevoius epoch
  let prevProdTableStr = "";
  if (oldState) {
    prevProdTableStr = getChunksBlocksEndorsementsStat(
      "Last Epoch Productivity",
      oldState
    );
  }

  console.log("kicked out object: " , kickoutStatus); 

  const kickedOutMsg =
  kickoutStatus && kickoutStatus.reason &&
    [
      "Kicked out 😟: \n",
      "```\n",
      JSON.stringify(kickoutStatus.reason, null, 2),
      "\n```",
    ].join("");

  const fullMessage = [
    `**🆕 EPOCH ${epochHeight}**`,
    getPoolId(poolId),
    epochTableStr,
    Math.abs(parseFloat(stakeDifference)) >  0 ? `💎 Stake changes: ${stakeDifference} N |  ${percentIcon} ${stakePercentChange.toFixed(3)}%` : "",
    prevProdTableStr,
    kickedOutMsg ? kickedOutMsg : "",
  ].join("\n");

  return fullMessage;
};

export const getPoolId = (poolId) => `\n 👷 ${poolId}\n`;