Pod::Spec.new do |s|
  s.name           = 'TmsHttpCache'
  s.version        = '1.0.0'
  s.summary        = 'Sem cache HTTP em disco no app do TMS (T-13)'
  s.description    = 'Desliga o URLCache em disco e apaga as respostas gravadas antes, na abertura e no logout.'
  s.license        = 'UNLICENSED'
  s.author         = 'TMS'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }
  s.source_files = '**/*.swift'
end
