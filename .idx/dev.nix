{ pkgs, ... }: {
  channel = "stable-23.11";
  packages = [
    pkgs.nodejs_20
    pkgs.pnpm
  ];
  idx = {
    extensions = [ "vscodevim.vim" ];
    previews = {
      enable = true;
      previews = {
        web = {
          command = [ "pnpm" "--filter" "zarith" "dev" "--port" "$PORT" "--host" "0.0.0.0" ];
          manager = "web";
        };
      };
    };
  };
}