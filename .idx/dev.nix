{ pkgs, ... }: {
  packages = [
    pkgs.nodejs_20
    pkgs.pnpm
  ];
  idx = {
    extensions = [ "vscodevim.vim" ];
  };
}