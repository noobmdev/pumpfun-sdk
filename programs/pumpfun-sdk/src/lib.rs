use anchor_lang::prelude::*;

declare_id!("Fedqq2MDcAK2daypcvJTaquGUVufaFbSdVMof22mW98Z");

#[program]
pub mod pumpfun_sdk {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
