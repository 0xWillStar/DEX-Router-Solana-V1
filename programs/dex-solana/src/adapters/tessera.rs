use crate::adapters::common::{before_check, invoke_process, DexProcessor};
use crate::constants::tessera_program;
use crate::{error::ErrorCode, HopAccounts, TESSERA_SWAP_SELECTOR};
use anchor_lang::{prelude::*, solana_program::instruction::Instruction};
use anchor_spl::{token::Token, token_interface::TokenAccount};
use arrayref::array_ref;

const ARGS_LEN: usize = 18;

pub struct TesseraSwapAccounts<'info> {
    pub dex_program_id: &'info AccountInfo<'info>,
    pub swap_authority_pubkey: &'info AccountInfo<'info>,
    pub swap_source_token: InterfaceAccount<'info, TokenAccount>,
    pub swap_destination_token: InterfaceAccount<'info, TokenAccount>,

    pub global_state: &'info AccountInfo<'info>,
    pub pool_account: &'info AccountInfo<'info>,
    pub base_vault: &'info AccountInfo<'info>,
    pub quote_vault: &'info AccountInfo<'info>,
    pub base_mint: &'info AccountInfo<'info>,
    pub quote_mint: &'info AccountInfo<'info>,
    pub base_token_program: Program<'info, Token>,
    pub quote_token_program: Program<'info, Token>,
    pub instructions_sysvar: &'info AccountInfo<'info>,
}

const SWAP_ACCOUNTS_LEN: usize = 13;

impl<'info> TesseraSwapAccounts<'info> {
    fn parse_accounts(accounts: &'info [AccountInfo<'info>], offset: usize) -> Result<Self> {
        let [
            dex_program_id,
            swap_authority_pubkey,
            swap_source_token,
            swap_destination_token,
            global_state,
            pool_account,
            base_vault,
            quote_vault,
            base_mint,
            quote_mint,
            base_token_program,
            quote_token_program,
            instructions_sysvar,
        ]: &[AccountInfo<'info>; SWAP_ACCOUNTS_LEN] =
            array_ref![accounts, offset, SWAP_ACCOUNTS_LEN];

        Ok(Self {
            dex_program_id,
            swap_authority_pubkey,
            swap_source_token: InterfaceAccount::try_from(swap_source_token)?,
            swap_destination_token: InterfaceAccount::try_from(swap_destination_token)?,
            global_state,
            pool_account,
            base_vault,
            quote_vault,
            base_mint,
            quote_mint,
            base_token_program: Program::try_from(base_token_program)?,
            quote_token_program: Program::try_from(quote_token_program)?,
            instructions_sysvar,
        })
    }
}

pub struct TesseraSwapProcessor;
impl DexProcessor for TesseraSwapProcessor {}

pub fn swap<'a>(
    remaining_accounts: &'a [AccountInfo<'a>],
    amount_in: u64,
    offset: &mut usize,
    hop_accounts: &mut HopAccounts,
    hop: usize,
    proxy_swap: bool,
    owner_seeds: Option<&[&[&[u8]]]>,
) -> Result<u64> {
    msg!("Dex::Tessera amount_in: {}, offset: {}", amount_in, offset);
    require!(
        remaining_accounts.len() >= *offset + SWAP_ACCOUNTS_LEN,
        ErrorCode::InvalidAccountsLength
    );

    let mut swap_accounts = TesseraSwapAccounts::parse_accounts(remaining_accounts, *offset)?;
    if swap_accounts.dex_program_id.key != &tessera_program::id() {
        return Err(ErrorCode::InvalidProgramId.into());
    }
    swap_accounts.pool_account.key().log();

    before_check(
        &swap_accounts.swap_authority_pubkey,
        &swap_accounts.swap_source_token,
        swap_accounts.swap_destination_token.key(),
        hop_accounts,
        hop,
        proxy_swap,
        owner_seeds,
    )?;

    // Determine trade side by the mint of the input token:
    // - source mint == base_mint  => ask (sell base for quote)  => side = 1
    // - source mint == quote_mint => bid (sell quote for base) => side = 0
    let source_mint = swap_accounts.swap_source_token.mint;
    let destination_mint = swap_accounts.swap_destination_token.mint;
    let base_mint_key = swap_accounts.base_mint.key();
    let quote_mint_key = swap_accounts.quote_mint.key();

    let (side, base_account, quote_account) = if source_mint == base_mint_key
        && destination_mint == quote_mint_key {
        // ask: base -> quote
        (1u8, &swap_accounts.swap_source_token, &swap_accounts.swap_destination_token)
    } else if source_mint == quote_mint_key && destination_mint == base_mint_key {
        // bid: quote -> base
        (0u8, &swap_accounts.swap_destination_token, &swap_accounts.swap_source_token)
    } else {
        return Err(ErrorCode::InvalidTokenMint.into());
    };

    let mut data = Vec::with_capacity(ARGS_LEN);
    data.extend_from_slice(TESSERA_SWAP_SELECTOR);
    data.push(side);
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&1u64.to_le_bytes());

    let accounts = vec![
        AccountMeta::new_readonly(swap_accounts.global_state.key(), false),
        AccountMeta::new(swap_accounts.pool_account.key(), false),
        AccountMeta::new(swap_accounts.swap_authority_pubkey.key(), true),
        AccountMeta::new(swap_accounts.base_vault.key(), false),
        AccountMeta::new(swap_accounts.quote_vault.key(), false),
        AccountMeta::new(base_account.key(), false),
        AccountMeta::new(quote_account.key(), false),
        AccountMeta::new_readonly(swap_accounts.base_mint.key(), false),
        AccountMeta::new_readonly(swap_accounts.quote_mint.key(), false),
        AccountMeta::new_readonly(swap_accounts.base_token_program.key(), false),
        AccountMeta::new_readonly(swap_accounts.quote_token_program.key(), false),
        AccountMeta::new_readonly(swap_accounts.instructions_sysvar.key(), false),
    ];

    let account_infos = vec![
        swap_accounts.global_state.to_account_info(),
        swap_accounts.pool_account.to_account_info(),
        swap_accounts.swap_authority_pubkey.to_account_info(),
        swap_accounts.base_vault.to_account_info(),
        swap_accounts.quote_vault.to_account_info(),
        base_account.to_account_info(),
        quote_account.to_account_info(),
        swap_accounts.base_mint.to_account_info(),
        swap_accounts.quote_mint.to_account_info(),
        swap_accounts.base_token_program.to_account_info(),
        swap_accounts.quote_token_program.to_account_info(),
        swap_accounts.instructions_sysvar.to_account_info(),
    ];

    let instruction =
        Instruction { program_id: swap_accounts.dex_program_id.key(), accounts, data };

    let dex_processor = &TesseraSwapProcessor;
    let amount_out = invoke_process(
        amount_in,
        dex_processor,
        &account_infos,
        &mut swap_accounts.swap_source_token,
        &mut swap_accounts.swap_destination_token,
        hop_accounts,
        instruction,
        hop,
        offset,
        SWAP_ACCOUNTS_LEN,
        proxy_swap,
        owner_seeds,
    )?;

    Ok(amount_out)
}


