#import "FilePicker.h"
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>
#import <MobileCoreServices/MobileCoreServices.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

@interface FilePicker () <UIDocumentPickerDelegate>
@property (nonatomic, strong) RCTPromiseResolveBlock resolveBlock;
@property (nonatomic, strong) RCTPromiseRejectBlock rejectBlock;
@end

@implementation FilePicker

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(pickFile:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    self.resolveBlock = resolve;
    self.rejectBlock = reject;
    
    dispatch_async(dispatch_get_main_queue(), ^{
        UIViewController *rootViewController = RCTPresentedViewController();
        
        if (!rootViewController) {
            reject(@"ERROR", @"Unable to get root view controller", nil);
            return;
        }
        
        UIDocumentPickerViewController *documentPicker;
        
        if (@available(iOS 14.0, *)) {
            // iOS 14+ - use UTType
            NSArray<UTType *> *types = @[UTTypeItem]; // All file types
            documentPicker = [[UIDocumentPickerViewController alloc] initForOpeningContentTypes:types];
        } else {
            // iOS 13 and below - use old API
            NSArray<NSString *> *types = @[@"public.item"]; // All file types
            documentPicker = [[UIDocumentPickerViewController alloc] initWithDocumentTypes:types inMode:UIDocumentPickerModeOpen];
        }
        
        documentPicker.delegate = self;
        documentPicker.allowsMultipleSelection = NO;
        
        [rootViewController presentViewController:documentPicker animated:YES completion:nil];
    });
}

#pragma mark - UIDocumentPickerDelegate

- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls {
    if (urls.count > 0) {
        NSURL *url = urls[0];
        
        // Start accessing security-scoped resource
        BOOL didStartAccessing = [url startAccessingSecurityScopedResource];
        
        NSDictionary *result = @{
            @"uri": url.absoluteString,
            @"path": url.path ?: @""
        };
        
        if (self.resolveBlock) {
            self.resolveBlock(result);
        }
        
        if (didStartAccessing) {
            [url stopAccessingSecurityScopedResource];
        }
    } else {
        if (self.rejectBlock) {
            self.rejectBlock(@"ERROR", @"No file selected", nil);
        }
    }
    
    self.resolveBlock = nil;
    self.rejectBlock = nil;
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller {
    if (self.rejectBlock) {
        self.rejectBlock(@"CANCELLED", @"User cancelled file picker", nil);
    }
    
    self.resolveBlock = nil;
    self.rejectBlock = nil;
}

@end

